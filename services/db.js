const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const getFilePath = (collection) => path.join(DATA_DIR, `${collection}.json`);

const read = (collection) => {
  const filePath = getFilePath(collection);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${collection}:`, err);
    return [];
  }
};

const write = (collection, data) => {
  const filePath = getFilePath(collection);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error(`Error writing ${collection}:`, err);
    return false;
  }
};

module.exports = {
  read,
  write,
  // Helper methods
  findAll: (collection) => read(collection),
  findOne: (collection, query) => {
    const data = read(collection);
    return data.find((item) =>
      Object.keys(query).every((key) => item[key] === query[key])
    );
  },
  insert: (collection, item) => {
    const data = read(collection);
    const newItem = { id: Date.now().toString(), ...item, createdAt: new Date().toISOString() };
    data.push(newItem);
    write(collection, data);
    return newItem;
  },
  update: (collection, id, updates) => {
    const data = read(collection);
    const index = data.findIndex((item) => item.id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...updates, updatedAt: new Date().toISOString() };
      write(collection, data);
      return data[index];
    }
    return null;
  },
  pushToArray: (collection, id, arrayKey, value) => {
    const data = read(collection);
    const index = data.findIndex((item) => item.id === id);
    if (index !== -1) {
      if (!Array.isArray(data[index][arrayKey])) {
        data[index][arrayKey] = [];
      }
      data[index][arrayKey].push(value);
      write(collection, data);
      return data[index];
    }
    return null;
  },
  // New: Get private messages between two users
  getPrivateMessages: (user1Id, user2Id) => {
    const messages = read("private_messages");
    return messages.filter(
      (msg) =>
        (msg.senderId === user1Id && msg.receiverId === user2Id) ||
        (msg.senderId === user2Id && msg.receiverId === user1Id)
    );
  },
  // New: Insert private message
  insertPrivateMessage: (message) => {
    const messages = read("private_messages");
    const newMessage = { id: Date.now().toString(), ...message, createdAt: new Date().toISOString() };
    messages.push(newMessage);
    write("private_messages", messages);
    return newMessage;
  },
  // New: Search users by username
  searchUsers: (query) => {
    const users = read("users");
    const lowerCaseQuery = query.toLowerCase();
    return users.filter((user) =>
      user.username.toLowerCase().includes(lowerCaseQuery)
    ).map(user => { 
        const { password, ...userData } = user; 
        return userData; 
    });
  },
};
