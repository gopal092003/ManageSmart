const jwt = require("jsonwebtoken");
const Manager = require("../models/Manager");
require("dotenv").config();

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization header missing" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key-change-in-production"
    );
    // attach manager to request
    console.log("Payload:", payload);
    const manager = await Manager.findById(payload.id).select("-password");
    if (!manager) return res.status(401).json({ message: "Manager not found" });
    req.manager = manager;
    console.log("Manager found:", manager);
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid/expired token" });
  }
};

module.exports = auth;
