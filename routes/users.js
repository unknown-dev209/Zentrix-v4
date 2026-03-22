const express = require("express");
const router = express.Router();
const db = require("../services/db");
const auth = require("../middleware/auth");
const userController = require("../controllers/userController");

router.get("/", auth, (req, res) => {
  try {
    const users = db.findAll("users").map((user) => {
      const { password, ...userData } = user;
      return userData;
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/search", auth, userController.searchUsers);

module.exports = router;
