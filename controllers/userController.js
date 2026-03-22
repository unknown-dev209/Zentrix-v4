const db = require("../services/db");

exports.searchUsers = (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }
    const users = db.searchUsers(query);
    res.json(users);
  } catch (err) {
    console.error("Search users error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
