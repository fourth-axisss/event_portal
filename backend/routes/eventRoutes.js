const express = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { requireEventPermission, requireEventView } = require('../middleware/requireEventPermission');
const { EVENT_PERMISSIONS } = require('../config/constants');
const v = require('../validators/eventValidators');
const c = require('../controllers/eventController');
const s = require('../controllers/sessionController');

   const b = require('../controllers/browseController');

const router = express.Router();
const manage = requireEventPermission(EVENT_PERMISSIONS.MANAGE);

   // Participant: browse and detail
   router.get('/events', authenticate, validate(v.browseRules), b.listEvents);
   router.get('/events/:id', authenticate, requireEventView, b.getEvent);

// Organizer lists and form
router.get('/organize/event-form-options', authenticate, c.getFormOptions);
router.get('/organize/events', authenticate, c.listMyEvents);

// Create, edit, lifecycle
router.post('/events', authenticate, validate(v.eventCreate), c.createEvent);
router.patch('/events/:id', authenticate, manage, validate(v.eventUpdate), c.updateEvent);
router.delete('/events/:id', authenticate, manage, c.deleteEvent);
router.post('/events/:id/publish', authenticate, manage, c.publishEvent);
router.post('/events/:id/unpublish', authenticate, manage, c.unpublishEvent);
router.post('/events/:id/cancel', authenticate, manage, validate(v.cancelRules), c.cancelEvent);

// Sessions
router.get('/events/:id/sessions', authenticate, requireEventView, s.listSessions);
router.post('/events/:id/sessions', authenticate, manage, validate(v.sessionCreate), s.createSession);
router.patch('/events/:id/sessions/:sessionId', authenticate, manage, validate(v.sessionUpdate), s.updateSession);
router.delete('/events/:id/sessions/:sessionId', authenticate, manage, validate(v.sessionIdRules), s.deleteSession);

module.exports = router;