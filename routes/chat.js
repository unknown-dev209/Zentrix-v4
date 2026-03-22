const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');

// In Express 5, use separate routes for optional parameters or specific patterns
router.get('/', auth, chatController.getMessages);
router.get('/:groupId', auth, chatController.getMessages);
router.post('/', auth, chatController.sendMessage);

module.exports = router;
