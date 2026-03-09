const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Library = require("../models/Library");
const Seat = require("../models/Seat");
const { libraryResister, libraryMe } = require("../controller/library.controller");

// POST /api/library/register
// Protected; manager can register a single library (one-to-one)
router.post("/registerlibrary", auth, libraryResister);
 
// GET /api/library/me -> fetch manager's library and summary
router.get("/me", auth, libraryMe);

module.exports = router;
