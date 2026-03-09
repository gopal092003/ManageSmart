// models/Library.js
const mongoose = require("mongoose");

const LibrarySchema = new mongoose.Schema({
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Manager",
    unique: true,
  }, // 1 manager → 1 library
  name: { type: String, required: true },
  capacity: { type: Number, required: true }, // number of seats
  quote: String,
  location: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Library", LibrarySchema);
