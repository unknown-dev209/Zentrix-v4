const db = require('../services/db');

exports.updateStatus = (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'Status is required' });

    const updatedUser = db.update('users', req.user.id, {
      status,
      statusUpdatedAt: new Date().toISOString()
    });

    if (!updatedUser) return res.status(404).json({ message: 'User not found' });

    res.json({ status: updatedUser.status, updatedAt: updatedUser.statusUpdatedAt });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAllStatuses = (req, res) => {
  try {
    const users = db.findAll('users');
    const statuses = users.map(user => ({
      username: user.username,
      status: user.status || 'Offline',
      updatedAt: user.statusUpdatedAt || user.createdAt
    }));
    res.json(statuses);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
