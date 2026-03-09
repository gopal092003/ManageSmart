import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Manager from "../models/Manager.js";
import dotenv from "dotenv";
dotenv.config();

export const authRegister =  async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "Name, email, and password are required" });

    // Normalize email to lowercase and trim
    const normalizedEmail = email.toLowerCase().trim();
    
    const existing = await Manager.findOne({ email: normalizedEmail });
    if (existing)
      return res.status(400).json({ message: "Email already registered" });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const manager = new Manager({ 
      name: name.trim(), 
      email: normalizedEmail, 
      password: hashed 
    });
    await manager.save();

    const token = jwt.sign(
      { id: manager._id },
      process.env.JWT_SECRET || "your-secret-key-change-in-production",
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      }
    );
    res
      .status(201)
      .json({
        token,
        manager: { id: manager._id, name: manager.name, email: manager.email },
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}


export const authLogin =  async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    // Case-insensitive email search using regex
    // This works even if emails were stored in different cases
    const normalizedEmail = email.trim();
    // Escape special regex characters in email
    const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const manager = await Manager.findOne({ 
      email: { $regex: new RegExp(`^${escapedEmail}$`, "i") }
    });
    
    if (!manager) {
      console.log("Login attempt failed: Manager not found for email:", normalizedEmail);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log("Manager found, comparing password for:", manager.email);
    console.log("Manager ID:", manager._id);
    
    const isMatch = await bcrypt.compare(password, manager.password);
    if (!isMatch) {
      console.log("Login attempt failed: Invalid password for email:", normalizedEmail);
      console.log("Password comparison failed");
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log("Password match successful, generating token...");
    const token = jwt.sign(
      { id: manager._id },
      process.env.JWT_SECRET || "your-secret-key-change-in-production",
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      }
    );
    
    console.log("Login successful for manager:", manager.email, "ID:", manager._id);
    res.json({
      token,
      manager: { 
        id: manager._id, 
        name: manager.name, 
        email: manager.email 
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ message: "Server error during login", error: err.message });
  }
};