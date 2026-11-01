const express = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { requireEventPermission, requireEventView } = require('../middleware/requireEventPermission');
const { EVENT_PERMISSIONS } = require('../config/constants');
const v = require('../validators/feedbackValidators');
const c = require('../controllers/feedbackController');

const router = express.Router();

router.post('/events/:id/feedback', authenticate, requireEventView, validate(v.feedbackRules), c.submit);
router.get('/events/:id/feedback', authenticate, requireEventPermission(EVENT_PERMISSIONS.MANAGE), c.summary);

module.exports = router;