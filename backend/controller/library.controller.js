import Library from "../models/Library.js";
import Seat from "../models/Seat.js";


export const libraryResister = async (req, res) => {
  try {
    const { name, capacity, quote, location, shifts } = req.body;
    // shifts: array of { name, startTime, endTime } - these are the shift templates for seats
    if (!name || !Array.isArray(shifts) || shifts.length === 0) {
      return res.status(400).json({
        message: "Missing required fields. Provide name, capacity and shifts.",
      });
    }

    // validate capacity is a positive number
    if (typeof capacity !== "number" || capacity <= 0) {
      return res
        .status(400)
        .json({ message: "Capacity must be a positive number" });
    }

    // validate each shift has required fields
    for (const s of shifts) {
      if (!s.name || !s.startTime || !s.endTime) {
        return res.status(400).json({
          message: "Each shift must include name, startTime and endTime",
        });
      }
    }

    // ensure manager doesn't already have a library
    const existingLib = await Library.findOne({ managerId: req.manager._id });
    if (existingLib) {
      return res
        .status(400)
        .json({ message: "Manager already has a registered library" });
    }

    const library = new Library({
      managerId: req.manager._id,
      name,
      capacity,
      quote,
      location,
    });

    await library.save();

    // generate seats
    const seatDocs = [];
    for (let i = 1; i <= capacity; i++) {
      const seatShifts = shifts.map((s) => ({
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        studentId: null,
      }));
      seatDocs.push({
        libraryId: library._id,
        seatNumber: i,
        shifts: seatShifts,
      });
    }
    // bulk insert seats
    await Seat.insertMany(seatDocs);

    res
      .status(201)
      .json({ message: "Library registered", libraryId: library._id });
  } catch (err) {
    console.error("Library registration error:", err);
    // return detailed error message and stack for debugging (remove in production)
    res.status(500).json({ message: err.message, stack: err.stack });
  }
};


export const libraryMe =  async (req, res) => {
  try {
    // Ensure we're getting the library for the authenticated manager
    const lib = await Library.findOne({ managerId: req.manager._id }).lean();
    if (!lib) {
      console.log(`No library found for manager: ${req.manager._id} (${req.manager.email})`);
      return res
        .status(404)
        .json({ message: "No library found for this manager" });
    }

    console.log(`Fetching library data for manager: ${req.manager.email}, Library ID: ${lib._id}`);

    // Fetch seats along with library data, sorted by seatNumber
    const seats = await Seat.find({ libraryId: lib._id })
      .sort({ seatNumber: 1 }) // Sort by seatNumber ascending
      .lean();
    
    const bookedCount = await Seat.countDocuments({
      libraryId: lib._id,
      "shifts.studentId": { $ne: null },
    });

    // Add counts and manager info to library data
    const libraryData = {
      ...lib,
      bookedSeatsCount: bookedCount,
      manager: {
        id: req.manager._id,
        name: req.manager.name,
        email: req.manager.email,
      },
    };

    console.log(`Returning library data: ${libraryData.name}, ${seats.length} seats`);

    res.json({
      library: libraryData,
      seats: seats,
    });
  } catch (err) {
    console.error("Error fetching library data:", err);
    res.status(500).json({ message: "Server error" });
  }
};