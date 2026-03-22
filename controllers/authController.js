const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../services/db');

exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const existingUser = db.findOne('users', { username });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = db.insert('users', {
      username,
      password: hashedPassword,
      status: 'Online',
      statusUpdatedAt: new Date().toISOString()
    });

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username },
      process.env.JWT_SECRET || 'chatstream_secret_key_12345',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: { id: newUser.id, username: newUser.username }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = db.findOne('users', { username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'chatstream_secret_key_12345',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMe = (req, res) => {
  try {
    const user = db.findOne('users', { id: req.user.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const { password, ...userData } = user;
    res.json(userData);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
