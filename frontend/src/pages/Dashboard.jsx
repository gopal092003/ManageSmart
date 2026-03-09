import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import SeatModal from "../components/SeatModal";
import dbService from "../services/db";
import {
  getDataWithOfflineFallback,
  syncDataFromServer,
} from "../services/offlineSync";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../services/db";

function Dashboard() {
 const [selectedSeatNumber, setSelectedSeatNumber] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const queryClient = useQueryClient();

  const handleLogout = async () => {
    // Clear all data
    localStorage.removeItem("token");
    localStorage.removeItem("manager");
    // Clear React Query cache to prevent showing other manager's data
    queryClient.clear();
    // Clear IndexedDB
    await dbService.clearAll();
    navigate("/login");
  };

  // Get manager info from localStorage
  const getManagerInfo = () => {
    try {
      const managerStr = localStorage.getItem("manager");
      return managerStr ? JSON.parse(managerStr) : null;
    } catch (e) {
      return null;
    }
  };

  const managerInfo = getManagerInfo();
  const managerId = managerInfo?.id || null;

  // Live UI updates from IndexedDB when offline
  const liveLibrary = useLiveQuery(
    () => db.libraries.where("managerId").equals(managerId).first(),
    [managerId]
  );

  const liveSeats = useLiveQuery(
    () =>
      liveLibrary
        ? db.seats.where("libraryId").equals(liveLibrary._id).toArray()
        : [],
    [liveLibrary]
  );
  // Sync data when component mounts and online
  useEffect(() => {
    const syncData = async () => {
      if (navigator.onLine && managerId) {
        try {
          await syncDataFromServer();
        } catch (error) {
          console.error("Error syncing data:", error);
        }
      }
    };
    syncData();
  }, [managerId]);

  // `library`, `seats`, and `displaySeats` are computed earlier (kept above to preserve hooks order)

  // Fetch library and seats data with offline support
  // Query key includes manager ID to ensure each manager gets their own data
  const {
    data,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["librarySummary", managerId], // Unique per manager
    queryFn: async () => {
      try {
        console.log("Fetching library data for manager:", managerId);

        return await getDataWithOfflineFallback(
          // Online: fetch from API
          async () => {
            // First get the library data
            const libraryRes = await api.get("/library/me");
            const libraryData = libraryRes.data;

            if (!libraryData?.library?._id) {
              throw new Error("No library found");
            }

            // Verify the library belongs to the logged-in manager
            // Convert both to strings for reliable comparison
            const expectedManagerId = String(managerId);
            const foundManagerId = String(
              libraryData.library.manager?.id || ""
            );
            if (managerId && expectedManagerId !== foundManagerId) {
              console.error("Library manager ID mismatch!", {
                expected: expectedManagerId,
                found: foundManagerId,
              });
              throw new Error("Library data does not match logged-in manager");
            }

            // Then get the seats data
            const seatsRes = await api.get(`/seats/${libraryData.library._id}`);
            console.log("Library Response:", libraryData);
            console.log("Seats Response:", seatsRes.data);

            // Save to IndexedDB for offline access
            await dbService.saveLibrary(libraryData.library);
            await dbService.saveSeats(seatsRes.data.seats);

            // Read seats back from IndexedDB after save (this will include merged local unsynced bookings)
            const mergedSeats = await dbService.getSeats(libraryData.library._id);

            // Compute booked seats count as number of seats where ALL shifts are occupied (fully booked)
            const bookedCount = (mergedSeats || []).reduce((acc, s) => {
              const shifts = Array.isArray(s.shifts) ? s.shifts : [];
              const fullyBooked = shifts.length > 0 && shifts.every((sh) => !!sh.studentId);
              return acc + (fullyBooked ? 1 : 0);
            }, 0);

            const libraryWithCount = { ...libraryData.library, bookedSeatsCount: bookedCount };

            // Persist library with updated count
            await dbService.saveLibrary(libraryWithCount);

            return {
              library: libraryWithCount,
              seats: mergedSeats,
            };
          },
          // Offline: get from IndexedDB
          async () => {
            console.log("Using offline data from IndexedDB");
            const library = await dbService.getLibrary(managerId);
            if (!library) {
              throw new Error("No library found in offline storage");
            }
            const seats = await dbService.getSeats(library._id);
            return {
              library,
              seats,
            };
          }
        );
      } catch (err) {
        console.error("API Error:", err);
        throw err;
      }
    },
    enabled: !!localStorage.getItem("token") && !!managerId, // Only run if we have a token and manager ID
    refetchOnWindowFocus: navigator.onLine, // Only refetch when online
    refetchOnMount: true,
    staleTime: navigator.onLine ? 0 : Infinity, // Use cached data when offline
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (!navigator.onLine) return false;
      return failureCount < 2;
    },
  });

  // Prefer fresh query data when available, otherwise fall back to live IndexedDB values so UI shows immediately
  // Prefer librarySummary data, but if its seats are missing use the dedicated seats cache
  const library = data?.library ?? liveLibrary;
  const seatsFromSeatsCache = library?._id ? queryClient.getQueryData(["seats", library._id]) : null;
  // Prefer librarySummary seats when present and non-empty; otherwise fall back to the dedicated seats cache or liveIndexedDB
  const seats = (data?.seats && Array.isArray(data.seats) && data.seats.length > 0)
    ? data.seats
    : (Array.isArray(seatsFromSeatsCache) && seatsFromSeatsCache.length > 0)
      ? seatsFromSeatsCache
      : liveSeats;

  // Keep last known full seats snapshot to avoid transient partial lists after optimistic updates
  const [lastSeatsSnapshot, setLastSeatsSnapshot] = useState(null);
  const lastSnapshotTimeRef = useRef(0);

  // When seats are updated, maintain snapshot if it's a larger set
  // Depend only on `seats` to avoid effect re-running due to our own snapshot state updates
  useEffect(() => {
    if (!seats) return;
    const now = Date.now();
    const snapshotLen = Array.isArray(lastSeatsSnapshot) ? lastSeatsSnapshot.length : 0;
    const seatsLen = Array.isArray(seats) ? seats.length : 0;

    // If seats is empty or smaller than snapshot, keep snapshot for 3s to avoid flicker
    if (snapshotLen > seatsLen && now - lastSnapshotTimeRef.current < 3000) {
      return;
    }

    // Otherwise update snapshot only when necessary
    if (seatsLen > 0) {
      setLastSeatsSnapshot((prev) => (prev === seats ? prev : seats));
      lastSnapshotTimeRef.current = now;
    } else if (seatsLen === 0 && snapshotLen === 0) {
      setLastSeatsSnapshot([]);
      lastSnapshotTimeRef.current = now;
    }
  }, [seats]);

  const displaySeats = (() => {
    const seatsLen = Array.isArray(seats) ? seats.length : 0;
    const snapLen = Array.isArray(lastSeatsSnapshot) ? lastSeatsSnapshot.length : 0;
    if (seatsLen === 0 && snapLen > 0) return lastSeatsSnapshot;
    if (seatsLen > 0 && (seatsLen >= snapLen || snapLen === 0)) return seats;
    // seatsLen > 0 but smaller than snapshot and snapshot recent -> show snapshot
    if (snapLen > seatsLen && Date.now() - lastSnapshotTimeRef.current < 3000) return lastSeatsSnapshot;
    return seats || [];
  })();

  if (loading && !liveLibrary && !liveSeats) {
    return (
      <div className="dashboard-container">
        <div className="container">
          <div className="text-center py-5">
            <div
              className="spinner-border text-primary mb-3"
              role="status"
              style={{ width: "3rem", height: "3rem" }}
            >
              <span className="visually-hidden">Loading...</span>
            </div>
            <h4 className="text-muted">Loading your library data...</h4>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">
          Error loading data: {error.message}
          {error.response?.status === 401 && (
            <div>
              <hr />
              <p>Please try logging in again.</p>
              <button
                className="btn btn-primary"
                onClick={() => (window.location.href = "/login")}
              >
                Go to Login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!data?.library) {
    return (
      <div className="container mt-5">
        <div className="alert alert-warning">
          No library found. Please register a library first.
          <hr />
          <button
            className="btn btn-primary"
            onClick={() => (window.location.href = "/library/register")}
          >
            Register Library
          </button>
        </div>
      </div>
    );
  }
 

  // Minimized logging to avoid noisy output in console

  // Additional verification: ensure library belongs to logged-in manager
  const expectedId = String(managerId || "");
  const libraryManagerId = String(library?.manager?.id || "");
  if (managerId && library?.manager?.id && expectedId !== libraryManagerId) {
    console.error(
      "SECURITY WARNING: Library does not belong to logged-in manager!",
      {
        expected: expectedId,
        found: libraryManagerId,
      }
    );
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">
          <h4>Access Denied</h4>
          <p>
            This library does not belong to your account. Please log out and log
            in with the correct credentials.
          </p>
          <button className="btn btn-primary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    );
  }

  const handleSeatClick = (seat) => {
  setSelectedSeatNumber(seat.seatNumber);
};


  // Sort seats by seatNumber to ensure correct order
  const sortedSeats = displaySeats
    ? [...displaySeats].sort((a, b) => a.seatNumber - b.seatNumber)
    : [];
const selectedSeat = sortedSeats.find(
  (s) => s.seatNumber === selectedSeatNumber
);

  return (
    <div className="dashboard-container">
      <div className="container">
        <div className="dashboard-header">
          <div className="d-flex justify-content-between align-items-start flex-wrap">
            <div>
              <h2 className="mb-2">📚 {library.name || "Library Dashboard"}</h2>
              {library.location && (
                <p className="text-muted mb-1">📍 {library.location}</p>
              )}
              {(library.manager || managerInfo) && (
                <p className="text-muted mb-0">
                  👤 Manager:{" "}
                  <strong>
                    {library.manager?.name || managerInfo?.name || "Unknown"}
                  </strong>
                </p>
              )}
            </div>
            <div className="d-flex align-items-center gap-2">
              {managerInfo && (
                <span className="badge bg-primary">👋 {managerInfo.name}</span>
              )}
              <button className="btn btn-outline-danger" onClick={handleLogout}>
                🚪 Logout
              </button>
            </div>
          </div>
        </div>

        {/* Library Info */}
        {library.quote && (
          <div className="alert alert-info mb-4">
            <strong>💬 Library Quote:</strong> <em>"{library.quote}"</em>
          </div>
        )}

        {/* Summary Cards */}
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="summary-card total">
              <h5>📊 Total Seats</h5>
              <h3>{library.capacity || 0}</h3>
            </div>
          </div>
          <div className="col-md-4">
            <div className="summary-card booked">
              <h5>✅ Booked Seats</h5>
              <h3>{library.bookedSeatsCount || 0}</h3>
            </div>
          </div>
          <div className="col-md-4">
            <div className="summary-card available">
              <h5>🆓 Available Seats</h5>
              <h3>
                {(library.capacity || 0) - (library.bookedSeatsCount || 0)}
              </h3>
            </div>
          </div>
        </div>

        {/* Seat Grid */}
        <div className="seat-grid-container">
          <h4 className="seat-grid-title">🪑 Seat Grid</h4>
          {sortedSeats.length > 0 && (
            <div className="mb-3 p-2 bg-light rounded">
              <small className="text-muted">
                <strong>Total Seats:</strong> {sortedSeats.length}
                {library.capacity &&
                  sortedSeats.length !== library.capacity && (
                    <span className="text-warning ms-2">
                      (Expected: {library.capacity})
                    </span>
                  )}
                {" | "}
                <strong>Shifts per Seat:</strong>{" "}
                {sortedSeats[0]?.shifts?.length || 0}
                {sortedSeats[0]?.shifts?.length > 0 && (
                  <span className="ms-2">
                    (
                    {sortedSeats[0].shifts
                      .map((s) => `${s.name} (${s.startTime}-${s.endTime})`)
                      .join(", ")}
                    )
                  </span>
                )}
              </small>
            </div>
          )}
          {sortedSeats.length === 0 && library.capacity > 0 && (
            <div className="alert alert-warning">
              No seats found. Expected {library.capacity} seats. Please check
              your library configuration.
            </div>
          )}
          <div className="d-flex flex-wrap gap-3">
            {sortedSeats && sortedSeats.length > 0 ? (
              <>
                {sortedSeats.map((seat) => {
                  const bookedShifts = seat.shifts.filter(
                    (s) => s.studentId
                  ).length;
                  const isFullyBooked = bookedShifts === seat.shifts.length;
                  const bookingPercentage =
                    (bookedShifts / seat.shifts.length) * 100;

                  // Determine seat class based on booking status
                  let seatClass = "available";
                  if (isFullyBooked) {
                    seatClass = "full";
                  } else if (bookingPercentage >= 50) {
                    seatClass = "partial";
                  }

                  return (
                    <div
                      key={seat._id || `${seat.libraryId}-${seat.seatNumber}`}
                      className={`seat-item ${seatClass}`}
                      onClick={() => handleSeatClick(seat)}
                    >
                      <div className="seat-number">{seat.seatNumber}</div>
                      <div className="seat-status">
                        {bookedShifts}/{seat.shifts.length}
                      </div>
                    </div>
                  );
                })}

                {/* Seat Modal */}
    <SeatModal
  show={!!selectedSeat}
  onHide={() => setSelectedSeatNumber(null)}
  seat={selectedSeat}
  library={library}
/>


              </>
            ) : (
              <div className="alert alert-info w-100">
                No seats found. Please check your library configuration.
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="legend-container">
          <h6 className="mb-3">📋 Legend:</h6>
          <div className="d-flex gap-4 flex-wrap">
            <div className="legend-item">
              <div
                className="legend-color"
                style={{
                  background:
                    "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
                  borderColor: "var(--success-color)",
                }}
              ></div>
              <small>
                <strong>Available</strong> - Seat is free
              </small>
            </div>
            <div className="legend-item">
              <div
                className="legend-color"
                style={{
                  background:
                    "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                  borderColor: "var(--warning-color)",
                }}
              ></div>
              <small>
                <strong>Partially Booked</strong> - Some shifts occupied
              </small>
            </div>
            <div className="legend-item">
              <div
                className="legend-color"
                style={{
                  background:
                    "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
                  borderColor: "var(--danger-color)",
                }}
              ></div>
              <small>
                <strong>Fully Booked</strong> - All shifts occupied
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
