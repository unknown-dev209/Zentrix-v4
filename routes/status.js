const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');
const auth = require('../middleware/auth');

router.post('/', auth, statusController.updateStatus);
router.get('/', auth, statusController.getAllStatuses);

module.exports = router;
