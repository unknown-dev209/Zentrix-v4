require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./services/db");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/groups", require("./routes/groups"));
app.use("/api/status", require("./routes/status"));

// Fallback for SPA
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// User mapping for private messages
const userSocketMap = {};

// Socket.IO Connection Handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // When a user connects, they should send their userId to map it to their socketId
  socket.on("register_user", (userId) => {
    userSocketMap[userId] = socket.id;
    console.log(`User ${userId} registered with socket ${socket.id}`);
  });

  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
  });

  socket.on("send_message", (data) => {
    let newMessage;
    if (data.groupId) {
      // Group message
      newMessage = db.insert("messages", {
        text: data.text,
        senderId: data.senderId,
        senderName: data.senderName,
        groupId: data.groupId,
        timestamp: new Date().toISOString(),
      });
      io.to(data.groupId).emit("receive_message", newMessage);
    } else if (data.receiverId) {
      // Private message
      newMessage = db.insertPrivateMessage({
        text: data.text,
        senderId: data.senderId,
        senderName: data.senderName,
        receiverId: data.receiverId,
        timestamp: new Date().toISOString(),
      });
      
      const receiverSocketId = userSocketMap[data.receiverId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("receive_message", newMessage);
      }
      // Send back to sender as well
      socket.emit("receive_message", newMessage);
    } else {
      // Global message
      newMessage = db.insert("messages", {
        text: data.text,
        senderId: data.senderId,
        senderName: data.senderName,
        groupId: null,
        receiverId: null,
        timestamp: new Date().toISOString(),
      });
      io.emit("receive_message", newMessage);
    }
  });

  socket.on("typing", (data) => {
    if (data.groupId) {
      socket.to(data.groupId).emit("typing", data);
    } else if (data.receiverId) {
      const receiverSocketId = userSocketMap[data.receiverId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing", data);
      }
    }
  });

  socket.on("stop_typing", (data) => {
    if (data.groupId) {
      socket.to(data.groupId).emit("stop_typing", data);
    } else if (data.receiverId) {
      const receiverSocketId = userSocketMap[data.receiverId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("stop_typing", data);
      }
    }
  });

  socket.on("status_update", (data) => {
    io.emit("status_changed", {
      username: data.username,
      status: data.status,
      updatedAt: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    // Remove user from map
    for (const userId in userSocketMap) {
      if (userSocketMap[userId] === socket.id) {
        delete userSocketMap[userId];
        break;
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ChatStream server running on port ${PORT}`);
});
