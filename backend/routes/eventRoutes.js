const express = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const v = require('../validators/eventValidators');
const c = require('../controllers/eventController');

const router = express.Router();

router.get('/organize/event-form-options', authenticate, c.getFormOptions);
router.get('/organize/events', authenticate, c.listMyEvents);
router.post('/events', authenticate, validate(v.eventCreate), c.createEvent);

module.exports = router;