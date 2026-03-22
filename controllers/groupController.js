const db = require('../services/db');

exports.createGroup = (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    const newGroup = db.insert('groups', {
      name,
      creatorId: req.user.id,
      members: [req.user.id]
    });

    res.status(201).json(newGroup);
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getGroups = (req, res) => {
  try {
    const groups = db.findAll('groups');
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.joinGroup = (req, res) => {
  try {
    const { groupId } = req.params;
    const group = db.findOne('groups', { id: groupId });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.members.includes(req.user.id)) {
      return res.status(400).json({ message: 'Already a member' });
    }

    db.pushToArray('groups', groupId, 'members', req.user.id);
    res.json({ message: 'Joined group successfully' });
  } catch (err) {
    console.error('Join group error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
