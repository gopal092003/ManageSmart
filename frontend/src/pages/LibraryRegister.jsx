import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

function LibraryRegister() {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [quote, setQuote] = useState("");
  const [location, setLocation] = useState("");
  const [shifts, setShifts] = useState([
    { name: "Morning", startTime: "", endTime: "" },
  ]);
  const navigate = useNavigate();

  const handleShiftChange = (index, field, value) => {
    const newShifts = [...shifts];
    newShifts[index][field] = value;
    setShifts(newShifts);
  };

  const addShift = () =>
    setShifts([...shifts, { name: "", startTime: "", endTime: "" }]);

  const handleRegister = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!name.trim()) {
      alert("Library name is required");
      return;
    }

    const capacityNum = parseInt(capacity, 10);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      alert("Please enter a valid positive number for capacity");
      return;
    }

    // Validate shifts
    const invalidShift = shifts.find(
      (s) => !s.name.trim() || !s.startTime || !s.endTime
    );
    if (invalidShift) {
      alert(
        "Please fill in all shift details (name, start time, and end time)"
      );
      return;
    }

    try {
      await api.post("/library/registerlibrary", {
        name: name.trim(),
        capacity: capacityNum,
        quote: quote.trim(),
        location: location.trim(),
        shifts,
      });
      navigate("/dashboard"); // after library registration, go to dashboard
    } catch (err) {
      console.error("Registration error:", err);
      alert(
        err.response?.data?.message ||
          err.message ||
          "Library registration failed"
      );
    }
  };

  return (
    <div className="dashboard-container">
      <div className="container">
        <div className="dashboard-header">
          <h2 className="mb-0">📚 Register Your Library</h2>
          <p className="text-muted mb-0">Fill in the details to set up your library</p>
        </div>

        <div className="seat-grid-container mt-4">
          <form onSubmit={handleRegister}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-bold">📖 Library Name *</label>
                <input
                  className="form-control"
                  placeholder="Enter library name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold">🔢 Capacity *</label>
                <input
                  className="form-control"
                  type="number"
                  min="1"
                  placeholder="Number of seats"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold">📍 Location</label>
                <input
                  className="form-control"
                  placeholder="Library location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold">💬 Quote</label>
                <input
                  className="form-control"
                  placeholder="Library quote or motto"
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <h5 className="mb-3">⏰ Shifts Configuration</h5>
              <p className="text-muted small mb-3">Configure the time shifts for your library seats</p>
              {shifts.map((shift, index) => (
                <div key={index} className="shift-card mb-3">
                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label small">Shift Name</label>
                      <input
                        className="form-control"
                        placeholder="e.g., Morning"
                        value={shift.name}
                        onChange={(e) => handleShiftChange(index, "name", e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small">Start Time</label>
                      <input
                        className="form-control"
                        type="time"
                        placeholder="HH:mm"
                        value={shift.startTime}
                        onChange={(e) =>
                          handleShiftChange(index, "startTime", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small">End Time</label>
                      <input
                        className="form-control"
                        type="time"
                        placeholder="HH:mm"
                        value={shift.endTime}
                        onChange={(e) =>
                          handleShiftChange(index, "endTime", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-outline-secondary mb-4"
                onClick={addShift}
              >
                ➕ Add Another Shift
              </button>
            </div>

            <div className="d-flex gap-2 mt-4">
              <button type="submit" className="btn btn-primary px-5">
                ✨ Register Library
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LibraryRegister;
