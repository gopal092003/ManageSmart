const mongoose = require("mongoose");

const ShiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // "Morning"
    startTime: { type: String, required: true }, // "08:00"
    endTime: { type: String, required: true }, // "12:00"
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },
  },
  { _id: false }
); // shifts are embedded objects

const SeatSchema = new mongoose.Schema({
  libraryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Library",
    required: true,
  },
  lastUpdatedAt: {
  type: Date,
  default: Date.now
},
  seatNumber: { type: Number, required: true },
  shifts: { type: [ShiftSchema], default: [] },
});

SeatSchema.index({ libraryId: 1, seatNumber: 1 }, { unique: true });

module.exports = mongoose.model("Seat", SeatSchema);
