const db = require("../services/db");

exports.getMessages = (req, res) => {
  try {
    const { groupId, userId } = req.query; // Use req.query for groupId and userId
    const messages = db.findAll("messages");

    let filteredMessages = [];

    if (groupId) {
      // Group chat messages
      filteredMessages = messages.filter((msg) => msg.groupId === groupId);
    } else if (userId) {
      // Private chat messages
      filteredMessages = db.getPrivateMessages(req.user.id, userId);
    } else {
      // Global chat messages (no groupId or userId)
      filteredMessages = messages.filter((msg) => !msg.groupId && !msg.receiverId);
    }

    res.json(filteredMessages);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.sendMessage = (req, res) => {
  try {
    const { text, groupId, receiverId } = req.body;
    if (!text) return res.status(400).json({ message: "Text is required" });

    let newMessage;
    if (groupId) {
      // Group message
      newMessage = db.insert("messages", {
        text,
        senderId: req.user.id,
        senderName: req.user.username,
        groupId: groupId,
        timestamp: new Date().toISOString(),
      });
    } else if (receiverId) {
      // Private message
      newMessage = db.insertPrivateMessage({
        text,
        senderId: req.user.id,
        senderName: req.user.username,
        receiverId: receiverId,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Global message
      newMessage = db.insert("messages", {
        text,
        senderId: req.user.id,
        senderName: req.user.username,
        groupId: null,
        receiverId: null,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(201).json(newMessage);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
