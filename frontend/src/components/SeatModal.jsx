import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookSeat, deleteSeatBooking, updateStudent } from "../api";
import { sendWhatsAppReminder } from "../services/sendWhatsApp";
import { db } from "../services/db";
import { queueOperation } from "../services/offlineSync";

import { v4 as uuidv4 } from "uuid";


const SeatModal = ({ show, onHide, seat, library }) => {
  const [localSeat, setLocalSeat] = useState(seat);

  const [studentDetails, setStudentDetails] = useState({
    name: "",
    email: "",
    phone: "",
    rollNo: "",
    shiftName: "",
  });

  const [editingShift, setEditingShift] = useState(null);
  const [editStudentDetails, setEditStudentDetails] = useState({
    name: "",
    email: "",
    phone: "",
    rollNo: "",
  });

  const queryClient = useQueryClient();

  // Helper to load seats from IndexedDB for a library
  const loadSeatsFromIDB = async (libraryId) => {
    try {
      return await db.seats.where("libraryId").equals(libraryId).sortBy("seatNumber");
    } catch (e) {
      console.warn("Could not read seats from IndexedDB:", e);
      return [];
    }
  };

  // Compute booked count as total number of booked shifts across all seats
  const computeBookedSeatsCount = (seatsArray) => {
    if (!Array.isArray(seatsArray)) return 0;
    return seatsArray.reduce((acc, s) => {
      const shifts = Array.isArray(s.shifts) ? s.shifts : [];
      const fullyBooked = shifts.length > 0 && shifts.every((sh) => !!sh.studentId);
      return acc + (fullyBooked ? 1 : 0);
    }, 0);
  };

  // Update library record in IndexedDB and librarySummary cache with new booked count
  const updateLibraryBookedCount = async (libraryId, seatsArray) => {
    try {
      const bookedCount = computeBookedSeatsCount(seatsArray);

      // Update library in IndexedDB if present
      try {
        const libRec = await db.libraries.where("_id").equals(libraryId).first();
        if (libRec && libRec.id != null) {
          await db.libraries.update(libRec.id, { ...libRec, bookedSeatsCount: bookedCount, lastSynced: null });
        }
      } catch (e) {
        console.warn("Could not update library record in IndexedDB:", e);
      }

      // Update librarySummary cache
      try {
        const managerStr = localStorage.getItem("manager");
        const managerObj = managerStr ? JSON.parse(managerStr) : null;
        const managerId = managerObj?.id || null;
        if (managerId) {
          queryClient.setQueryData(["librarySummary", managerId], (old) => {
            const base = old || { library: null, seats: seatsArray };
            const lib = { ...(base.library || {}), bookedSeatsCount: bookedCount };
            return { ...base, library: lib, seats: seatsArray };
          });
        }
      } catch (e) {
        console.warn("Could not update librarySummary cache with booked count:", e);
      }
    } catch (e) {
      console.error("Error computing/updating booked count:", e);
    }
  };

  // Reset form when modal closes or seat changes
  useEffect(() => {
    if (!show) {
      setStudentDetails({
        name: "",
        email: "",
        phone: "",
        rollNo: "",
        shiftName: "",
      });
      setEditingShift(null);
      setEditStudentDetails({
        name: "",
        email: "",
        phone: "",
        rollNo: "",
      });
    }
  }, [show, seat]);

  // Load student data when editing
  useEffect(() => {
  if (editingShift && localSeat?.shifts) {
    const shift = localSeat.shifts.find((s) => s.name === editingShift);

      if (shift?.studentId) {
        const student = shift.studentId;
        setEditStudentDetails({
          name: student.name || "",
          email: student.email || "",
          phone: student.contact || "",
          rollNo: student.rollNo || "",
        });
      }
    }
  }, [editingShift, seat]);
   
  useEffect(() => {
  setLocalSeat(seat);
}, [seat]);

  const bookSeatMutation = useMutation({
    mutationFn: bookSeat,
    onSuccess: () => {
      queryClient.invalidateQueries(["librarySummary"]);
      queryClient.invalidateQueries(["seats", library._id]);
      setStudentDetails({
        name: "",
        email: "",
        phone: "",
        rollNo: "",
        shiftName: "",
      });
    },
  });

  const deleteSeatMutation = useMutation({
    mutationFn: deleteSeatBooking,
    // Optimistic update: remove booking locally immediately
    onMutate: async ({ libraryId, seatNumber, shiftName }) => {
      await queryClient.cancelQueries(["seats", libraryId]);
      const previousSeats = queryClient.getQueryData(["seats", libraryId]);

      // Update cache optimistically
      queryClient.setQueryData(["seats", libraryId], (oldSeats) => {
        const base = Array.isArray(oldSeats) ? oldSeats.slice() : [];
        const found = base.find((s) => s.seatNumber === seatNumber);
        if (found) {
          return base.map((s) =>
            s.seatNumber === seatNumber
              ? { ...s, shifts: s.shifts.map((sh) => (sh.name === shiftName ? { ...sh, studentId: null } : sh)) }
              : s
          );
        }
        const newSeat = {
          libraryId,
          seatNumber,
          shifts: [],
        };
        return [...base, newSeat];
      });

      // Also update librarySummary cache if present
      try {
        const managerStr = localStorage.getItem("manager");
        const managerObj = managerStr ? JSON.parse(managerStr) : null;
        const managerId = managerObj?.id || null;
        if (managerId) {
          queryClient.setQueryData(["librarySummary", managerId], (old) => {
            const base = old || { library: null, seats: [] };
            const seatsArr = Array.isArray(base.seats) ? base.seats.slice() : [];
            const found = seatsArr.find((s) => s.seatNumber === seatNumber);
            let updatedSeats;
            if (found) {
              updatedSeats = seatsArr.map((s) =>
                s.seatNumber === seatNumber ? { ...s, shifts: s.shifts.map((sh) => (sh.name === shiftName ? { ...sh, studentId: null } : sh)) } : s
              );
            } else {
              updatedSeats = [...seatsArr, { libraryId, seatNumber, shifts: [] }];
            }
            return { ...base, seats: updatedSeats };
          });
        }
      } catch (e) {
        console.warn("Could not update librarySummary cache optimistically", e);
      }

      // Update IndexedDB optimistically
      try {
        const seatRecord = await db.seats.where({ libraryId, seatNumber }).first();
        if (seatRecord && seatRecord.id != null) {
          const updatedShifts = (seatRecord.shifts || []).map((sh) => (sh.name === shiftName ? { ...sh, studentId: null } : sh));
          await db.seats.update(seatRecord.id, { shifts: updatedShifts });
        }
      } catch (e) {
        console.warn("Could not apply optimistic change to IndexedDB:", e);
      }

      // Update library booked count based on optimistic seats
      try {
        const seatsNow = queryClient.getQueryData(["seats", libraryId]) || [];
        await updateLibraryBookedCount(libraryId, seatsNow);
      } catch (e) {
        console.warn("Could not update booked count optimistically:", e);
      }

      return { previousSeats };
    },
    onError: async (err, variables, context) => {
      // Rollback cache
      try {
        const { libraryId } = variables;
        if (context?.previousSeats) {
          queryClient.setQueryData(["seats", libraryId], context.previousSeats);
          // restore IndexedDB seats from previousSeats
          try {
            await db.seats.where("libraryId").equals(libraryId).delete();
            await db.seats.bulkPut(context.previousSeats);
          } catch (e) {
            console.warn("Could not rollback IndexedDB after failed delete:", e);
          }
        }
      } catch (e) {
        console.error("Error during delete rollback:", e);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(["seats", library._id]);
      queryClient.invalidateQueries(["librarySummary"]);
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: ({ name, phone }) => sendWhatsAppReminder(name, phone),
  });

  const updateStudentMutation = useMutation({
    mutationFn: updateStudent,
    onSuccess: () => {
      queryClient.invalidateQueries(["librarySummary"]);
      queryClient.invalidateQueries(["seats", library._id]);
      setEditingShift(null);
      setEditStudentDetails({
        name: "",
        email: "",
        phone: "",
        rollNo: "",
      });
    },
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setStudentDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditStudentDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!studentDetails.shiftName) {
    alert("Please select a shift");
    return;
  }

  if (!library?._id || !localSeat?.seatNumber) {
    alert("Error: Missing library or seat information");
    return;
  }

    const operationId = uuidv4();

    const offlineStudentPayload = {
      libraryId: library._id,
      seatNumber: localSeat.seatNumber,
      shiftName: studentDetails.shiftName,
      name: studentDetails.name,
      rollNo: studentDetails.rollNo,
      email: studentDetails.email,
      contact: studentDetails.phone,
      operationId,
      createdAt: new Date().toISOString(),
    };

    try {
      // 1. Add student to IndexedDB and get generated numeric id
      const localId = await db.students.add({ ...offlineStudentPayload, lastSynced: navigator.onLine ? new Date().toISOString() : null });
      const storedStudent = await db.students.get(localId);

      // 2. Update seat entry to reference the stored student object
      const seatRecord = await db.seats
        .where({ libraryId: library._id, seatNumber: localSeat.seatNumber })
        .first();

      if (seatRecord && seatRecord.id != null) {
        await db.seats.update(seatRecord.id, {
          shifts: localSeat.shifts.map((shift) =>
            shift.name === studentDetails.shiftName
              ? { ...shift, studentId: storedStudent }
              : shift
          ),
        });
      } else {
        // If seat not found in IndexedDB, create/put a new one with shifts
        const newSeat = {
          libraryId: library._id,
          seatNumber: localSeat.seatNumber,
          shifts: localSeat.shifts.map((shift) =>
            shift.name === studentDetails.shiftName
              ? { ...shift, studentId: storedStudent }
              : shift
          ),
          lastSynced: null,
        };
        await db.seats.add(newSeat);
      }

      // 3. Update UI state immediately using the stored student (includes numeric id)
      setLocalSeat((prev) => ({
        ...prev,
        shifts: prev.shifts.map((shift) =>
          shift.name === studentDetails.shiftName
            ? { ...shift, studentId: storedStudent }
            : shift
        ),
      }));

      // 4. Update React Query cache so parent/list views refresh immediately
      try {
        // Ensure we merge with any existing seats from cache or IndexedDB
        try {
          let base = queryClient.getQueryData(["seats", library._id]);
          if (!Array.isArray(base) || base.length === 0) {
            base = await loadSeatsFromIDB(library._id);
          }

          const updatedSeats = base && base.length > 0
            ? base.map((s) =>
                s.seatNumber === localSeat.seatNumber
                  ? { ...s, shifts: s.shifts.map((shift) => (shift.name === studentDetails.shiftName ? { ...shift, studentId: storedStudent } : shift)) }
                  : s
              )
            : [
                {
                  libraryId: library._id,
                  seatNumber: localSeat.seatNumber,
                  shifts: localSeat.shifts.map((shift) => (shift.name === studentDetails.shiftName ? { ...shift, studentId: storedStudent } : shift)),
                },
              ];

          queryClient.setQueryData(["seats", library._id], updatedSeats);
        } catch (e) {
          console.warn("Could not update seats cache (merged):", e);
        }

        // After updating seats cache, recompute booked count and update library
        try {
          const seatsNow = queryClient.getQueryData(["seats", library._id]) || (await loadSeatsFromIDB(library._id));
          await updateLibraryBookedCount(library._id, seatsNow);
        } catch (e) {
          console.warn("Could not update booked count after booking:", e);
        }
      } catch (err) {
        console.warn("Could not update seats cache:", err);
      }

      // Also update the librarySummary cache so Dashboard (which uses that query) refreshes immediately
      try {
        const managerStr = localStorage.getItem("manager");
        const managerObj = managerStr ? JSON.parse(managerStr) : null;
        const managerId = managerObj?.id || null;

        if (managerId) {
          // Merge librarySummary seats with IDB/cache when needed
          try {
            let base = queryClient.getQueryData(["librarySummary", managerId]);
            if (!base || !Array.isArray(base.seats) || base.seats.length === 0) {
              // try to build base from IDB
              const idbSeats = await loadSeatsFromIDB(library._id);
              base = { library: library || null, seats: idbSeats };
            }

            const seatsArr = Array.isArray(base.seats) ? base.seats.slice() : [];
            const found = seatsArr.find((s) => s.seatNumber === localSeat.seatNumber);
            let updatedSeats;
            if (found) {
              updatedSeats = seatsArr.map((s) =>
                s.seatNumber === localSeat.seatNumber ? { ...s, shifts: s.shifts.map((sh) => (sh.name === studentDetails.shiftName ? { ...sh, studentId: storedStudent } : sh)) } : s
              );
            } else {
              updatedSeats = [...seatsArr, { libraryId: library._id, seatNumber: localSeat.seatNumber, shifts: localSeat.shifts.map((shift) => (shift.name === studentDetails.shiftName ? { ...shift, studentId: storedStudent } : shift)) }];
            }

            const lib = { ...(base.library || {}), lastSynced: base.library?.lastSynced };
            const bookedCount = computeBookedSeatsCount(updatedSeats);
            lib.bookedSeatsCount = bookedCount;

            (async () => {
              try {
                const libRec = await db.libraries.where("_id").equals(library._id).first();
                if (libRec && libRec.id != null) {
                  await db.libraries.update(libRec.id, { ...libRec, bookedSeatsCount: bookedCount, lastSynced: null });
                }
              } catch (e) {
                console.warn("Could not persist library booked count after booking:", e);
              }
            })();

            queryClient.setQueryData(["librarySummary", managerId], { ...base, library: lib, seats: updatedSeats });
          } catch (e) {
            console.warn("Could not update librarySummary cache (merged):", e);
          }
        }
      } catch (err) {
        console.warn("Could not update librarySummary cache:", err);
      }



    // ✅ 2. QUEUE OPERATION FOR BACKEND SYNC
    await queueOperation(
  "POST",
  `/seats/${library._id}/${localSeat.seatNumber}/book`,
  offlineStudentPayload
);

  

    alert(
      navigator.onLine
        ? "Seat booked successfully"
        : "Seat booked (offline mode)"
    );

    setStudentDetails({
      name: "",
      email: "",
      phone: "",
      rollNo: "",
      shiftName: "",
    });

    onHide();
  } catch (error) {
    console.error(error);
    alert(navigator.onLine
    ? "Seat saved locally, syncing…"
    : "Seat booked offline");
  }
};


  const handleDelete = async (shiftName) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the booking for ${shiftName} shift?`
      )
    ) {
      return;
    }

    // If online, use mutation which will call backend and then update caches
    if (navigator.onLine) {
      deleteSeatMutation.mutate({
        libraryId: library._id,
        seatNumber: seat.seatNumber,
        shiftName,
      });
      return;
    }

    // Offline: perform local delete in IndexedDB and queue operation for sync
    try {
      // 1. Remove student record if present
      const shift = localSeat.shifts.find((s) => s.name === shiftName);
      const student = shift?.studentId;
      if (student && student.id != null) {
        await db.students.delete(student.id);
      }

      // 2. Update seat shifts to remove student reference
      const seatRecord = await db.seats
        .where({ libraryId: library._id, seatNumber: localSeat.seatNumber })
        .first();

      const updatedShifts = (localSeat.shifts || []).map((s) =>
        s.name === shiftName ? { ...s, studentId: null } : s
      );

      if (seatRecord && seatRecord.id != null) {
        await db.seats.update(seatRecord.id, { shifts: updatedShifts });
      }

      // 3. Update local UI state and React Query caches
      setLocalSeat((prev) => ({ ...prev, shifts: updatedShifts }));

      try {
        queryClient.setQueryData(["seats", library._id], (oldSeats) => {
          const base = Array.isArray(oldSeats) ? oldSeats.slice() : [];
          const found = base.find((s) => s.seatNumber === localSeat.seatNumber);
          if (found) {
            return base.map((s) =>
              s.seatNumber === localSeat.seatNumber
                ? { ...s, shifts: s.shifts.map((sh) => (sh.name === shiftName ? { ...sh, studentId: null } : sh)) }
                : s
            );
          }
          // If missing, append a seat with studentId null in the shift
          const newSeat = {
            libraryId: library._id,
            seatNumber: localSeat.seatNumber,
            shifts: (localSeat.shifts || []).map((sh) => (sh.name === shiftName ? { ...sh, studentId: null } : sh)),
          };
          return [...base, newSeat];
        });

        const managerStr = localStorage.getItem("manager");
        const managerObj = managerStr ? JSON.parse(managerStr) : null;
        const managerId = managerObj?.id || null;

        if (managerId) {
          queryClient.setQueryData(["librarySummary", managerId], (old) => {
            const base = old || { library: library || null, seats: [] };
            const seatsArr = Array.isArray(base.seats) ? base.seats.slice() : [];
            const found = seatsArr.find((s) => s.seatNumber === localSeat.seatNumber);
            let updatedSeats;
            if (found) {
              updatedSeats = seatsArr.map((s) =>
                s.seatNumber === localSeat.seatNumber
                  ? { ...s, shifts: s.shifts.map((sh) => (sh.name === shiftName ? { ...sh, studentId: null } : sh)) }
                  : s
              );
            } else {
              const newSeat = {
                libraryId: library._id,
                seatNumber: localSeat.seatNumber,
                shifts: (localSeat.shifts || []).map((sh) => (sh.name === shiftName ? { ...sh, studentId: null } : sh)),
              };
              updatedSeats = [...seatsArr, newSeat];
            }
            const lib = { ...(base.library || {}), lastSynced: base.library?.lastSynced };
            const bookedCount = computeBookedSeatsCount(updatedSeats);
            lib.bookedSeatsCount = bookedCount;
            (async () => {
              try {
                const libRec = await db.libraries.where("_id").equals(library._id).first();
                if (libRec && libRec.id != null) {
                  await db.libraries.update(libRec.id, { ...libRec, bookedSeatsCount: bookedCount, lastSynced: null });
                }
              } catch (e) {
                console.warn("Could not persist library booked count after delete:", e);
              }
            })();

            return { ...base, library: lib, seats: updatedSeats };
          });
        }
      } catch (err) {
        console.warn("Could not update caches after offline delete:", err);
      }

      // 4. Queue delete operation for sync
      await queueOperation(
        "DELETE",
        `/seats/${library._id}/${localSeat.seatNumber}/book/${shiftName}`,
        null
      );

      alert("Booking deleted locally and queued for sync (offline)");
      onHide();
    } catch (error) {
      console.error("Offline delete error:", error);
      alert("Could not delete booking locally");
    }
  };

  const handleEdit = (shiftName) => {
    setEditingShift(shiftName);
  };

  const handleReminder = (shiftName, student) => {
    const phone = student?.contact || student?.phone || "";
    const name = student?.name || "Student";

    if (!phone) {
      alert("No phone number available for this student.");
      return;
    }

    sendReminderMutation.mutate({ name, phone });
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!library?._id || !seat?.seatNumber || !editingShift) {
      alert("Error: Missing information");
      return;
    }

    // If online, call mutation which will update backend and invalidate caches
    if (navigator.onLine) {
      updateStudentMutation.mutate({
        libraryId: library._id,
        seatNumber: seat.seatNumber,
        shiftName: editingShift,
        studentDetails: editStudentDetails,
      });
      return;
    }

    // Offline: update local student record and seat shifts, then queue PUT for sync
    (async () => {
      try {
        // Find the shift and student object
        const shift = localSeat.shifts.find((s) => s.name === editingShift);
        const student = shift?.studentId;

        if (student && student.id != null) {
          const updatedStudent = {
            ...student,
            name: editStudentDetails.name,
            email: editStudentDetails.email,
            contact: editStudentDetails.phone,
            rollNo: editStudentDetails.rollNo,
            lastSynced: null,
          };

          await db.students.put(updatedStudent);

          // Update seat shifts
          const seatRecord = await db.seats
            .where({ libraryId: library._id, seatNumber: seat.seatNumber })
            .first();

          const updatedShifts = (localSeat.shifts || []).map((s) =>
            s.name === editingShift ? { ...s, studentId: updatedStudent } : s
          );

          if (seatRecord && seatRecord.id != null) {
            await db.seats.update(seatRecord.id, { shifts: updatedShifts });
          }

          // Update UI and caches
          setLocalSeat((prev) => ({ ...prev, shifts: updatedShifts }));

          try {
            queryClient.setQueryData(["seats", library._id], (oldSeats) => {
              const base = Array.isArray(oldSeats) ? oldSeats.slice() : [];
              const found = base.find((s) => s.seatNumber === seat.seatNumber);
              if (found) {
                return base.map((s) =>
                  s.seatNumber === seat.seatNumber
                    ? { ...s, shifts: s.shifts.map((sh) => (sh.name === editingShift ? { ...sh, studentId: updatedStudent } : sh)) }
                    : s
                );
              }
              const newSeat = { libraryId: library._id, seatNumber: seat.seatNumber, shifts: updatedShifts };
              return [...base, newSeat];
            });

            const managerStr = localStorage.getItem("manager");
            const managerObj = managerStr ? JSON.parse(managerStr) : null;
            const managerId = managerObj?.id || null;

            if (managerId) {
              queryClient.setQueryData(["librarySummary", managerId], (old) => {
                const base = old || { library: library || null, seats: [] };
                const seatsArr = Array.isArray(base.seats) ? base.seats.slice() : [];
                const found = seatsArr.find((s) => s.seatNumber === seat.seatNumber);
                let updatedSeats;
                if (found) {
                  updatedSeats = seatsArr.map((s) =>
                    s.seatNumber === seat.seatNumber ? { ...s, shifts: s.shifts.map((sh) => (sh.name === editingShift ? { ...sh, studentId: updatedStudent } : sh)) } : s
                  );
                } else {
                  updatedSeats = [...seatsArr, { libraryId: library._id, seatNumber: seat.seatNumber, shifts: updatedShifts }];
                }
                const lib = { ...(base.library || {}), lastSynced: base.library?.lastSynced };
                const bookedCount = computeBookedSeatsCount(updatedSeats);
                lib.bookedSeatsCount = bookedCount;

                (async () => {
                  try {
                    const libRec = await db.libraries.where("_id").equals(library._id).first();
                    if (libRec && libRec.id != null) {
                      await db.libraries.update(libRec.id, { ...libRec, bookedSeatsCount: bookedCount, lastSynced: null });
                    }
                  } catch (e) {
                    console.warn("Could not persist library booked count after edit:", e);
                  }
                })();

                return { ...base, library: lib, seats: updatedSeats };
              });
            }
          } catch (err) {
            console.warn("Could not update caches after offline edit:", err);
          }

          // Queue update for server sync
          await queueOperation(
            "PUT",
            `/seats/${library._id}/${seat.seatNumber}/book/${editingShift}`,
            {
              name: editStudentDetails.name,
              rollNo: editStudentDetails.rollNo,
              contact: editStudentDetails.phone,
              email: editStudentDetails.email,
            }
          );

          setEditingShift(null);
          alert("Student updated locally and queued for sync (offline)");
        } else {
          alert("No local student record found to update");
        }
      } catch (err) {
        console.error("Offline update error:", err);
        alert("Could not update locally");
      }
    })();
  };

  const handleCancelEdit = () => {
    setEditingShift(null);
    setEditStudentDetails({
      name: "",
      email: "",
      phone: "",
      rollNo: "",
    });
  };

  // Helper function to check if shift is occupied
  const isShiftOccupied = (shift) => {
    // Check if studentId exists and is an object (populated) or truthy (booked)
    return (
      shift.studentId &&
      (typeof shift.studentId === "object" ||
        (typeof shift.studentId === "string" && shift.studentId.length > 0))
    );
  };

  // Get student from shift
  const getStudentFromShift = (shift) => {
    // If studentId is an object, it's populated with student data
    if (shift.studentId && typeof shift.studentId === "object") {
      return shift.studentId;
    }
    return null;
  };

if (!show || !localSeat || !Array.isArray(localSeat.shifts)) {
  return null;
}



  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
  Seat {localSeat.seatNumber}
</Modal.Title>

      </Modal.Header>
      <Modal.Body>
        {localSeat.shifts && localSeat.shifts.length > 0 ? (
          <div>
            {localSeat.shifts.map((shift, index) => {
              const student = getStudentFromShift(shift);
              const isOccupied = !!student;
              const isEditing = editingShift === shift.name;

              return (
                <div key={index} className="shift-card">
                  <div className="shift-header">
                    <h5 className="shift-title">
                      ⏰ {shift.name} ({shift.startTime} - {shift.endTime})
                    </h5>
                    {isOccupied && !isEditing && (
                      <div>
                        <Button
                          variant="warning"
                          size="sm"
                          className="me-2"
                          onClick={() => handleEdit(shift.name)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(shift.name)}
                          disabled={deleteSeatMutation.isPending}
                        >
                          {deleteSeatMutation.isPending
                            ? "Deleting..."
                            : "Delete"}
                        </Button>
                        <Button
                          variant="info"
                          size="sm"
                          onClick={() => handleReminder(shift.name, student)}
                          disabled={
                            deleteSeatMutation.isPending ||
                            sendReminderMutation.isPending
                          }
                        >
                          {sendReminderMutation.isPending
                            ? "Sending..."
                            : "Reminder"}
                        </Button>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <Form onSubmit={handleEditSubmit}>
                      <Form.Group className="mb-3">
                        <Form.Label>Student Name</Form.Label>
                        <Form.Control
                          type="text"
                          name="name"
                          value={editStudentDetails.name}
                          onChange={handleEditInputChange}
                          required
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Email</Form.Label>
                        <Form.Control
                          type="email"
                          name="email"
                          value={editStudentDetails.email}
                          onChange={handleEditInputChange}
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Phone Number</Form.Label>
                        <Form.Control
                          type="tel"
                          name="phone"
                          value={editStudentDetails.phone}
                          onChange={handleEditInputChange}
                          required
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Roll Number</Form.Label>
                        <Form.Control
                          type="text"
                          name="rollNo"
                          value={editStudentDetails.rollNo}
                          onChange={handleEditInputChange}
                          required
                        />
                      </Form.Group>
                      <div className="d-flex gap-2">
                        <Button
                          variant="primary"
                          type="submit"
                          disabled={updateStudentMutation.isPending}
                        >
                          {updateStudentMutation.isPending
                            ? "Updating..."
                            : "Update"}
                        </Button>
                        <Button variant="secondary" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </Form>
                  ) : isOccupied ? (
                    <div className="student-info-card">
                      <strong className="text-primary">
                        👤 Student Information:
                      </strong>
                      <div className="mt-2">
                        <p className="mb-2">
                          <strong>📛 Name:</strong> {student.name}
                        </p>
                        <p className="mb-2">
                          <strong>🎫 Roll No:</strong> {student.rollNo}
                        </p>
                        <p className="mb-2">
                          <strong>📞 Contact:</strong> {student.contact}
                        </p>
                        {student.email && (
                          <p className="mb-0">
                            <strong>📧 Email:</strong> {student.email}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Alert variant="success">
                        ✅ This shift is available for booking
                      </Alert>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Booking Form for Available Shifts */}
            {localSeat.shifts.some((shift) => !isShiftOccupied(shift)) && (
              <div
                className="mt-4 p-4 border rounded"
                style={{
                  background:
                    "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                  borderColor: "var(--info-color)",
                }}
              >
                <h5 className="mb-3">📝 Book Available Shift</h5>
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>Student Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="name"
                      value={studentDetails.name}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      name="email"
                      value={studentDetails.email}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Phone Number</Form.Label>
                    <Form.Control
                      type="tel"
                      name="phone"
                      value={studentDetails.phone}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Roll Number</Form.Label>
                    <Form.Control
                      type="text"
                      name="rollNo"
                      value={studentDetails.rollNo}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Select Shift</Form.Label>
                    <Form.Control
                      as="select"
                      name="shiftName"
                      value={studentDetails.shiftName}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Choose a shift...</option>
                      {localSeat.shifts
                        .filter((shift) => !isShiftOccupied(shift))
                        .map((shift, index) => (
                          <option key={index} value={shift.name}>
                            {shift.name} ({shift.startTime} - {shift.endTime})
                          </option>
                        ))}
                    </Form.Control>
                  </Form.Group>
                  <div className="text-center">
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={bookSeatMutation.isPending}
                    >
                      {bookSeatMutation.isPending ? "Booking..." : "Book Seat"}
                    </Button>
                  </div>
                </Form>
              </div>
            )}
          </div>
        ) : (
          <p>No shifts are configured for this seat.</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SeatModal;
