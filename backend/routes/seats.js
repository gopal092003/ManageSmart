const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Seat = require("../models/Seat");
const Student = require("../models/Student");
const Library = require("../models/Library");
const mongoose = require("mongoose");
const { getSeatgrid, deleteShift, seatBooking, updateStudentInfo,getSingleSeatDetails } = require("../controller/seats.controller");
 
/** 
 * GET /api/seats/:libraryId
 * returns seat grid for a library
 */
router.get("/:libraryId", auth,getSeatgrid);

// DELETE /api/seats/:libraryId/:seatNumber/book/:shiftName
router.delete("/:libraryId/:seatNumber/book/:shiftName",auth,deleteShift);

/**
 * POST /api/seats/:libraryId/:seatNumber/book
 * Body: { name, rollNo, contact, shiftName }
 * Books the seat for a student in the requested shift (if available).
 */
router.post("/:libraryId/:seatNumber/book", auth, seatBooking);

/**
 * PUT /api/seats/:libraryId/:seatNumber/book/:shiftName
 * Body: { name, rollNo, contact, email }
 * Updates student information for a booked seat shift
 */
router.put("/:libraryId/:seatNumber/book/:shiftName",auth,updateStudentInfo);

/**
 * GET single seat details including shifts & student info
 * GET /api/seats/:libraryId/:seatNumber
 */
router.get("/:libraryId/:seatNumber", auth, getSingleSeatDetails);

module.exports = router;
