const express = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { requireEventPermission } = require('../middleware/requireEventPermission');
const { EVENT_PERMISSIONS } = require('../config/constants');
const v = require('../validators/attendanceValidators');
const c = require('../controllers/attendanceController');

const router = express.Router();
const attendancePermission = requireEventPermission(EVENT_PERMISSIONS.ATTENDANCE);

router.get('/events/:id/attendance', authenticate, attendancePermission, c.getAttendance);
router.put('/events/:id/sessions/:sessionId/attendance', authenticate, attendancePermission, validate(v.attendanceRules), c.saveSessionAttendance);

module.exports = router;