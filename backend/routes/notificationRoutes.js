const express = require('express');
const authenticate = require('../middleware/authenticate');
const c = require('../controllers/notificationController');

const router = express.Router();

router.get('/notifications/unread-count', authenticate, c.unreadCount);
router.get('/notifications', authenticate, c.list);
router.post('/notifications/read-all', authenticate, c.markAllRead);
router.post('/notifications/:id/read', authenticate, c.markRead);

module.exports = router;