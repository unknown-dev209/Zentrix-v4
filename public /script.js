/* ============================================
   GLOBAL STATE
   ============================================ */

let socket;
let currentUser = null;
let token = localStorage.getItem("chatstream_token");
let currentChatId = null;
let currentChatType = "global"; // global, group, or private
let currentChatName = "Global Chat";
let typingTimeout;
let userSocketMap = {};
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = 0;
let recordingInterval = null;
let allUsers = [];
let allGroups = [];
let allStatuses = [];
let currentStatusIndex = 0;
let statusViewerTimeout = null;

// Emoji list
const EMOJIS = ['😀', '😂', '😍', '😘', '😎', '🔥', '👍', '❤️', '😢', '😡', '🎉', '🚀', '💯', '✨', '🌟', '⭐', '👏', '🙌', '💪', '😴', '🤔', '😏', '😌', '😋', '🤤', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤬', '🤨', '😐', '😑', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😷', '🤒', '🤕', '🤮', '🤢', '🤮', '🤮', '🤮', '🤮'];

/* ============================================
   INITIALIZATION
   ============================================ */

window.addEventListener("load", () => {
  // Initialize dark mode preference (dark mode is default)
  const darkMode = localStorage.getItem("darkMode");
  if (darkMode === "false") {
    document.body.classList.add("light-mode");
    document.body.classList.remove("dark-mode");
  } else {
    document.body.classList.add("dark-mode");
    document.body.classList.remove("light-mode");
  }

  updateThemeToggle();

  // Check if user is already logged in
  if (token) {
    verifyToken();
  }

  // Initialize emoji picker
  initEmojiPicker();
});

/* ============================================
   AUTH FUNCTIONS
   ============================================ */

function toggleAuth(event) {
  event.preventDefault();
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  
  if (loginForm.style.display === "none") {
    loginForm.style.display = "block";
    registerForm.style.display = "none";
  } else {
    loginForm.style.display = "none";
    registerForm.style.display = "block";
  }
}

function handleLoginSubmit(event) {
  event.preventDefault();
  login();
}

function handleRegisterSubmit(event) {
  event.preventDefault();
  register();
}

async function login() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  if (!username || !password) {
    alert("Please fill in all fields");
    return;
  }

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("chatstream_token", data.token);
      token = data.token;
      currentUser = data.user;
      initApp();
    } else {
      alert(data.message || "Login failed");
    }
  } catch (err) {
    console.error("Login error:", err);
    alert("Login error. Please try again.");
  }
}

async function register() {
  const username = document.getElementById("register-username").value;
  const password = document.getElementById("register-password").value;

  if (!username || !password) {
    alert("Please fill in all fields");
    return;
  }

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("chatstream_token", data.token);
      token = data.token;
      currentUser = data.user;
      initApp();
    } else {
      alert(data.message || "Registration failed");
    }
  } catch (err) {
    console.error("Register error:", err);
    alert("Registration error. Please try again.");
  }
}

async function verifyToken() {
  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      currentUser = await res.json();
      initApp();
    } else {
      logout();
    }
  } catch (err) {
    console.error("Token verification error:", err);
    logout();
  }
}

function logout() {
  localStorage.removeItem("chatstream_token");
  window.location.reload();
}

/* ============================================
   APP INITIALIZATION
   ============================================ */

function initApp() {
  // Hide auth, show main app
  document.getElementById("auth-container").style.display = "none";
  document.getElementById("main-container").style.display = "flex";

  // Initialize Socket.IO
  socket = io();

  // Register user with socket
  socket.emit("register_user", currentUser.id);

  // Socket event listeners
  socket.on("receive_message", (message) => {
    if (
      (currentChatType === "global" &&
        !message.groupId &&
        !message.receiverId) ||
      (currentChatType === "group" && message.groupId === currentChatId) ||
      (currentChatType === "private" &&
        ((message.senderId === currentUser.id &&
          message.receiverId === currentChatId) ||
          (message.receiverId === currentUser.id &&
            message.senderId === currentChatId)))
    ) {
      displayMessage(message);
    }
  });

  socket.on("typing", (data) => {
    if (
      (currentChatType === "private" && data.senderId === currentChatId) ||
      (currentChatType === "group" && data.groupId === currentChatId)
    ) {
      showTypingIndicator(data.senderName);
    }
  });

  socket.on("stop_typing", (data) => {
    hideTypingIndicator(data.senderName);
  });

  socket.on("status_changed", () => {
    loadChats();
    loadStatuses();
  });

  // Load initial data
  loadChats();
  loadStatuses();
  switchToChat("global", null, "Global Chat");

  // Show chat list screen initially
  showChatListScreen();
}

/* ============================================
   SCREEN NAVIGATION
   ============================================ */

function showChatListScreen() {
  const chatListScreen = document.getElementById("chat-list-screen");
  const chatScreen = document.getElementById("chat-screen");
  const statusViewerScreen = document.getElementById("status-viewer-screen");

  chatListScreen.classList.add("active-screen");
  chatScreen.classList.remove("active-screen");
  statusViewerScreen.classList.remove("active-screen");

  chatListScreen.style.display = "flex";
  chatScreen.style.display = "none";
  statusViewerScreen.style.display = "none";
}

function showChatScreen() {
  const chatListScreen = document.getElementById("chat-list-screen");
  const chatScreen = document.getElementById("chat-screen");
  const statusViewerScreen = document.getElementById("status-viewer-screen");

  chatListScreen.classList.remove("active-screen");
  chatScreen.classList.add("active-screen");
  statusViewerScreen.classList.remove("active-screen");

  chatListScreen.style.display = "none";
  chatScreen.style.display = "flex";
  statusViewerScreen.style.display = "none";

  // Auto-scroll to bottom
  setTimeout(() => {
    const messagesContainer = document.getElementById("chat-messages");
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 100);
}

function showStatusViewerScreen() {
  const chatListScreen = document.getElementById("chat-list-screen");
  const chatScreen = document.getElementById("chat-screen");
  const statusViewerScreen = document.getElementById("status-viewer-screen");

  chatListScreen.classList.remove("active-screen");
  chatScreen.classList.remove("active-screen");
  statusViewerScreen.classList.add("active-screen");

  chatListScreen.style.display = "none";
  chatScreen.style.display = "none";
  statusViewerScreen.style.display = "flex";
}

function backToChatList() {
  showChatListScreen();
}

function closeStatusViewer() {
  if (statusViewerTimeout) {
    clearTimeout(statusViewerTimeout);
  }
  showChatListScreen();
  switchTab('chats', null);
}

/* ============================================
   TAB SWITCHING
   ============================================ */

function switchTab(tab, event) {
  if (event) {
    event.preventDefault();
  }

  const chatsList = document.getElementById("chats-list");
  const statusListContainer = document.getElementById("status-list-container");
  const groupsSection = document.getElementById("groups-section");
  const tabs = document.querySelectorAll(".tab-btn");

  // Remove active class from all tabs
  tabs.forEach((t) => t.classList.remove("active"));

  // Add active class to clicked tab
  if (event && event.target) {
    event.target.classList.add("active");
  } else {
    // Find and activate the tab by data-tab attribute
    tabs.forEach((t) => {
      if (t.getAttribute("data-tab") === tab) {
        t.classList.add("active");
      }
    });
  }

  // Show/hide sections based on tab
  if (tab === "chats") {
    chatsList.style.display = "flex";
    statusListContainer.style.display = "none";
    groupsSection.style.display = "none";
    loadChats();
  } else if (tab === "status") {
    chatsList.style.display = "none";
    statusListContainer.style.display = "flex";
    groupsSection.style.display = "none";
    loadStatuses();
  } else if (tab === "groups") {
    chatsList.style.display = "none";
    statusListContainer.style.display = "none";
    groupsSection.style.display = "flex";
    loadChats();
  }
}

/* ============================================
   CHAT LOADING
   ============================================ */

async function loadChats() {
  try {
    const [groupsRes, usersRes] = await Promise.all([
      fetch("/api/groups", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const groups = await groupsRes.json();
    const users = await usersRes.json();

    allGroups = groups;
    allUsers = users;

    const chatsList = document.getElementById("chats-list");
    const groupsList = document.getElementById("groups-list");

    chatsList.innerHTML = "";
    groupsList.innerHTML = "";

    // Add Global Chat
    const globalChatItem = createChatItem(
      "Global Chat",
      "Everyone",
      null,
      "global",
      null,
      "Global Chat"
    );
    chatsList.appendChild(globalChatItem);

    // Add Groups in chats list
    groups.forEach((group) => {
      const groupItem = createChatItem(
        group.name,
        "Group",
        null,
        "group",
        group.id,
        group.name
      );
      chatsList.appendChild(groupItem);
      
      // Also add to groups list
      const groupsListItem = createGroupListItem(group);
      groupsList.appendChild(groupsListItem);
    });

    // Add Users (for private chat)
    users
      .filter((user) => user.id !== currentUser.id)
      .forEach((user) => {
        const statusClass = `status-${(user.status || "Offline").toLowerCase()}`;
        const userItem = createChatItem(
          user.username,
          user.status || "Offline",
          statusClass,
          "private",
          user.id,
          user.username
        );
        chatsList.appendChild(userItem);
      });
  } catch (err) {
    console.error("Load chats error:", err);
  }
}

function createChatItem(name, preview, statusClass, type, id, chatName) {
  const item = document.createElement("li");
  item.className = "chat-item";

  // Create avatar
  const avatar = document.createElement("div");
  avatar.className = "chat-avatar";
  avatar.textContent = name.charAt(0).toUpperCase();

  // Create info section
  const info = document.createElement("div");
  info.className = "chat-info";

  const nameDiv = document.createElement("div");
  nameDiv.className = "chat-name";
  if (statusClass) {
    const badge = document.createElement("span");
    badge.className = `status-badge ${statusClass}`;
    nameDiv.appendChild(badge);
  }
  nameDiv.appendChild(document.createTextNode(name));

  const previewDiv = document.createElement("div");
  previewDiv.className = "chat-preview";
  previewDiv.textContent = preview;

  info.appendChild(nameDiv);
  info.appendChild(previewDiv);

  // Assemble item
  item.appendChild(avatar);
  item.appendChild(info);

  // Add click handler
  item.onclick = () => {
    switchToChat(type, id, chatName);
    showChatScreen();
  };

  // Mark as active if it's the current chat
  if (
    type === currentChatType &&
    ((type === "global" && !id) || id === currentChatId)
  ) {
    item.classList.add("active");
  }

  return item;
}

function createGroupListItem(group) {
  const item = document.createElement("div");
  item.className = "chat-item";

  const avatar = document.createElement("div");
  avatar.className = "chat-avatar";
  avatar.textContent = group.name.charAt(0).toUpperCase();

  const info = document.createElement("div");
  info.className = "chat-info";

  const nameDiv = document.createElement("div");
  nameDiv.className = "chat-name";
  nameDiv.textContent = group.name;

  const previewDiv = document.createElement("div");
  previewDiv.className = "chat-preview";
  previewDiv.textContent = `Members: ${group.members ? group.members.length : 0}`;

  info.appendChild(nameDiv);
  info.appendChild(previewDiv);

  item.appendChild(avatar);
  item.appendChild(info);

  item.onclick = () => {
    switchToChat("group", group.id, group.name);
    showChatScreen();
  };

  return item;
}

/* ============================================
   CHAT SWITCHING
   ============================================ */

async function switchToChat(type, id, chatName) {
  currentChatType = type;
  currentChatId = id;
  currentChatName = chatName;

  // Update header
  document.getElementById("current-room-name").textContent = chatName;
  document.getElementById("chat-header-status").textContent = getStatusText(type, id);

  // Clear messages
  const messagesContainer = document.getElementById("chat-messages");
  messagesContainer.innerHTML = "";

  // Load messages
  try {
    let url = "/api/chat";
    if (type === "group") {
      url += `?groupId=${id}`;
    } else if (type === "private") {
      url += `?userId=${id}`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const messages = await res.json();
    if (Array.isArray(messages)) {
      messages.forEach((msg) => displayMessage(msg));
    }
  } catch (err) {
    console.error("Load messages error:", err);
  }

  // Auto-scroll to bottom
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 100);
}

function getStatusText(type, id) {
  if (type === "global") {
    return "Public";
  } else if (type === "group") {
    const group = allGroups.find((g) => g.id === id);
    return group ? `${group.members ? group.members.length : 0} members` : "Group";
  } else if (type === "private") {
    const user = allUsers.find((u) => u.id === id);
    return user ? (user.status || "Offline") : "Offline";
  }
  return "";
}

/* ============================================
   MESSAGE DISPLAY & SENDING
   ============================================ */

function displayMessage(msg) {
  const container = document.getElementById("chat-messages");

  // Remove empty state if it exists
  const emptyState = container.querySelector(".empty-state");
  if (emptyState) {
    emptyState.remove();
  }

  const messageGroup = document.createElement("div");
  messageGroup.className = `message-group ${msg.senderId === currentUser.id ? "sent" : "received"}`;

  const message = document.createElement("div");
  message.className = "message";

  const time = new Date(msg.timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const textDiv = document.createElement("div");
  textDiv.className = "message-text";
  textDiv.textContent = msg.text;

  const timeDiv = document.createElement("div");
  timeDiv.className = "message-time";
  timeDiv.textContent = time;

  message.appendChild(textDiv);
  message.appendChild(timeDiv);
  messageGroup.appendChild(message);
  container.appendChild(messageGroup);

  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function sendMessage() {
  const input = document.getElementById("message-input");
  const text = input.value.trim();
  if (!text) return;

  const messageData = {
    text,
    senderId: currentUser.id,
    senderName: currentUser.username,
  };

  if (currentChatType === "group") {
    messageData.groupId = currentChatId;
  } else if (currentChatType === "private") {
    messageData.receiverId = currentChatId;
  }

  // Emit via socket
  socket.emit("send_message", messageData);

  // Also send via REST API to ensure it's saved
  fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(messageData),
  }).catch((err) => console.error("Send message error:", err));

  input.value = "";
  clearTypingIndicator();
}

function handleKeyPress(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

/* ============================================
   TYPING INDICATOR
   ============================================ */

function handleTyping() {
  const data = {
    senderId: currentUser.id,
    senderName: currentUser.username,
  };

  if (currentChatType === "group") {
    data.groupId = currentChatId;
  } else if (currentChatType === "private") {
    data.receiverId = currentChatId;
  }

  socket.emit("typing", data);

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("stop_typing", data);
  }, 1000);
}

function showTypingIndicator(username) {
  const container = document.getElementById("chat-messages");
  let typingDiv = document.getElementById("typing-indicator");

  if (!typingDiv || typingDiv.style.display === "none") {
    typingDiv = document.getElementById("typing-indicator");
    typingDiv.style.display = "flex";
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
  }
}

function hideTypingIndicator(username) {
  const typingDiv = document.getElementById("typing-indicator");
  if (typingDiv) {
    typingDiv.style.display = "none";
  }
}

function clearTypingIndicator() {
  clearTimeout(typingTimeout);
}

/* ============================================
   VOICE RECORDING
   ============================================ */

async function initVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
      sendAudioMessage(audioBlob);
      stream.getTracks().forEach((track) => track.stop());
      mediaRecorder = null;
    };

    return true;
  } catch (err) {
    console.error("Microphone access error:", err);
    alert("Please allow microphone access to send voice messages");
    return false;
  }
}

async function startRecording() {
  const hasPermission = await initVoiceRecording();
  if (!hasPermission) return;

  isRecording = true;
  audioChunks = [];
  recordingStartTime = Date.now();

  const micBtn = document.getElementById("mic-btn");
  micBtn.style.opacity = "0.5";

  const recordingIndicator = document.getElementById("recording-indicator");
  recordingIndicator.style.display = "flex";

  mediaRecorder.start();

  // Update recording time
  recordingInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById("recording-time").textContent = 
      `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, 100);
}

function stopRecording() {
  if (!isRecording || !mediaRecorder) return;

  isRecording = false;
  mediaRecorder.stop();
  clearInterval(recordingInterval);

  const micBtn = document.getElementById("mic-btn");
  micBtn.style.opacity = "1";

  const recordingIndicator = document.getElementById("recording-indicator");
  recordingIndicator.style.display = "none";
}

function sendAudioMessage(audioBlob) {
  const reader = new FileReader();
  reader.onload = () => {
    const audioData = reader.result;
    const messageData = {
      text: `[Audio Message]`,
      audio: audioData,
      senderId: currentUser.id,
      senderName: currentUser.username,
    };

    if (currentChatType === "group") {
      messageData.groupId = currentChatId;
    } else if (currentChatType === "private") {
      messageData.receiverId = currentChatId;
    }

    // Send as text message for now (audio support would require backend changes)
    socket.emit("send_message", {
      text: "[Voice Message]",
      senderId: currentUser.id,
      senderName: currentUser.username,
      groupId: messageData.groupId || null,
      receiverId: messageData.receiverId || null,
    });

    fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: "[Voice Message]",
        groupId: messageData.groupId,
        receiverId: messageData.receiverId,
      }),
    }).catch((err) => console.error("Send audio message error:", err));
  };
  reader.readAsDataURL(audioBlob);
}

// Mic button handler
document.addEventListener("DOMContentLoaded", () => {
  const micBtn = document.getElementById("mic-btn");
  if (micBtn) {
    let isHolding = false;

    micBtn.addEventListener("mousedown", () => {
      isHolding = true;
      startRecording();
    });

    micBtn.addEventListener("mouseup", () => {
      if (isHolding) {
        isHolding = false;
        stopRecording();
      }
    });

    micBtn.addEventListener("mouseleave", () => {
      if (isHolding) {
        isHolding = false;
        stopRecording();
      }
    });

    // Touch support
    micBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      isHolding = true;
      startRecording();
    });

    micBtn.addEventListener("touchend", (e) => {
      e.preventDefault();
      if (isHolding) {
        isHolding = false;
        stopRecording();
      }
    });
  }
});

/* ============================================
   EMOJI PICKER
   ============================================ */

function initEmojiPicker() {
  const emojiGrid = document.getElementById("emoji-grid");
  EMOJIS.forEach((emoji) => {
    const item = document.createElement("div");
    item.className = "emoji-item";
    item.textContent = emoji;
    item.onclick = () => {
      insertEmoji(emoji);
      closeEmojiPicker();
    };
    emojiGrid.appendChild(item);
  });
}

function openEmojiPicker() {
  const modal = document.getElementById("emoji-picker-modal");
  modal.style.display = "flex";
}

function closeEmojiPicker() {
  const modal = document.getElementById("emoji-picker-modal");
  modal.style.display = "none";
}

function insertEmoji(emoji) {
  const input = document.getElementById("message-input");
  input.value += emoji;
  input.focus();
}

// Emoji button handler
document.addEventListener("DOMContentLoaded", () => {
  const emojiBtn = document.getElementById("emoji-btn");
  if (emojiBtn) {
    emojiBtn.addEventListener("click", openEmojiPicker);
  }
});

/* ============================================
   STATUS / STORIES
   ============================================ */

async function loadStatuses() {
  try {
    const res = await fetch("/api/status", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statuses = await res.json();
    allStatuses = statuses.filter((s) => s.username !== currentUser.username);

    const statusList = document.getElementById("status-list");
    statusList.innerHTML = "";

    allStatuses.forEach((status) => {
      const item = document.createElement("div");
      item.className = "status-item";
      item.onclick = () => viewStatus(status);

      const avatar = document.createElement("div");
      avatar.className = "status-item-avatar";
      avatar.textContent = status.username.charAt(0).toUpperCase();

      const name = document.createElement("div");
      name.className = "status-item-name";
      name.textContent = status.username;

      item.appendChild(avatar);
      item.appendChild(name);
      statusList.appendChild(item);
    });
  } catch (err) {
    console.error("Load statuses error:", err);
  }
}

function viewStatus(status) {
  currentStatusIndex = allStatuses.indexOf(status);
  showStatusViewerScreen();

  const viewerName = document.getElementById("status-viewer-name");
  viewerName.textContent = status.username;

  const viewerBody = document.getElementById("status-viewer-body");
  viewerBody.innerHTML = "";

  const statusText = document.createElement("div");
  statusText.className = "status-viewer-text";
  statusText.textContent = `${status.username} is ${status.status}`;

  viewerBody.appendChild(statusText);

  // Auto-advance to next status after 5 seconds
  if (statusViewerTimeout) {
    clearTimeout(statusViewerTimeout);
  }
  statusViewerTimeout = setTimeout(() => {
    nextStatus();
  }, 5000);
}

function nextStatus() {
  if (currentStatusIndex < allStatuses.length - 1) {
    viewStatus(allStatuses[currentStatusIndex + 1]);
  } else {
    closeStatusViewer();
  }
}

function prevStatus() {
  if (currentStatusIndex > 0) {
    viewStatus(allStatuses[currentStatusIndex - 1]);
  }
}

/* ============================================
   SEARCH & GROUPS
   ============================================ */

async function searchUsers() {
  const query = document.getElementById("search-input").value.trim();
  if (!query) {
    document.getElementById("search-results").innerHTML = "";
    return;
  }

  try {
    const res = await fetch(`/api/users/search?query=${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const users = await res.json();
    const resultsDiv = document.getElementById("search-results");
    resultsDiv.innerHTML = "";

    users.forEach((user) => {
      if (user.id === currentUser.id) return; // Skip self

      const item = document.createElement("div");
      item.className = "search-result-item";

      const avatar = document.createElement("div");
      avatar.className = "search-result-avatar";
      avatar.textContent = user.username.charAt(0).toUpperCase();

      const info = document.createElement("div");
      info.className = "search-result-info";

      const name = document.createElement("div");
      name.className = "search-result-name";
      name.textContent = user.username;

      const status = document.createElement("div");
      status.className = "search-result-status";
      status.textContent = user.status || "Offline";

      info.appendChild(name);
      info.appendChild(status);

      item.appendChild(avatar);
      item.appendChild(info);

      item.onclick = () => {
        switchToChat("private", user.id, user.username);
        document.getElementById("search-input").value = "";
        resultsDiv.innerHTML = "";
        showChatScreen();
      };

      resultsDiv.appendChild(item);
    });
  } catch (err) {
    console.error("Search error:", err);
  }
}

async function createGroup() {
  const nameInput = document.getElementById("new-group-name");
  const name = nameInput.value.trim();
  if (!name) {
    alert("Please enter a group name");
    return;
  }

  try {
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      nameInput.value = "";
      loadChats();
      alert("Group created successfully!");
    } else {
      alert("Failed to create group");
    }
  } catch (err) {
    console.error("Create group error:", err);
    alert("Error creating group");
  }
}

/* ============================================
   THEME TOGGLE
   ============================================ */

function toggleDarkMode() {
  const isDarkMode = document.body.classList.contains("dark-mode");
  
  if (isDarkMode) {
    document.body.classList.remove("dark-mode");
    document.body.classList.add("light-mode");
    localStorage.setItem("darkMode", "false");
  } else {
    document.body.classList.add("dark-mode");
    document.body.classList.remove("light-mode");
    localStorage.setItem("darkMode", "true");
  }
  
  updateThemeToggle();
}

function updateThemeToggle() {
  const themeToggle = document.getElementById("theme-toggle");
  const moonIcon = themeToggle.querySelector(".icon-moon");
  const sunIcon = themeToggle.querySelector(".icon-sun");
  
  if (document.body.classList.contains("dark-mode")) {
    moonIcon.style.display = "block";
    sunIcon.style.display = "none";
  } else {
    moonIcon.style.display = "none";
    sunIcon.style.display = "block";
  }
}

// Attach theme toggle to button
document.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleDarkMode);
  }
});
