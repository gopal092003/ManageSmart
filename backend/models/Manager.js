// models/Manager.js
const mongoose = require("mongoose");

const ManagerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // hash later
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Manager", ManagerSchema);
