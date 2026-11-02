const express = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { requireEventPermission, requireEventView } = require('../middleware/requireEventPermission');
const { EVENT_PERMISSIONS } = require('../config/constants');
const v = require('../validators/announcementValidators');
const c = require('../controllers/announcementController');

const router = express.Router();
const announce = requireEventPermission(EVENT_PERMISSIONS.ANNOUNCEMENTS_FILES);

router.get('/events/:id/announcements', authenticate, requireEventView, c.list);
router.post('/events/:id/announcements', authenticate, announce, validate(v.createRules), c.create);
router.delete('/events/:id/announcements/:announcementId', authenticate, announce, validate(v.deleteRules), c.remove);

module.exports = router;