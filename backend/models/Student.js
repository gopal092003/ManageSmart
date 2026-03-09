// models/Student.js
const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema({
  libraryId: { type: mongoose.Schema.Types.ObjectId, ref: "Library" },
  name: { type: String, required: true },
  rollNo: { type: String, required: true },
  email: String,
  contact: String,
  shiftName: String, // Morning / Evening (optional duplicate for convenience)
  seatNumber: Number, // optional
  operationId: {
  type: String,
  unique: true,
  sparse: true
},
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Student", StudentSchema);
