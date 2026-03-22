const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const auth = require('../middleware/auth');

router.post('/', auth, groupController.createGroup);
router.get('/', auth, groupController.getGroups);
router.post('/:groupId/join', auth, groupController.joinGroup);

module.exports = router;
