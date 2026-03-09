const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Manager = require("../models/Manager");
require("dotenv").config();
const { authRegister, authLogin } = require("../controller/auth.controller");

// Register (manager signup)
router.post("/register",authRegister);

// Login
router.post("/login",authLogin);

module.exports = router;
