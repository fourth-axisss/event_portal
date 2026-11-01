const express = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { requireEventPermission } = require('../middleware/requireEventPermission');
const { EVENT_PERMISSIONS } = require('../config/constants');
const v = require('../validators/registrationValidators');
const c = require('../controllers/registrationController');

const router = express.Router();
const registrationsPermission = requireEventPermission(EVENT_PERMISSIONS.REGISTRATIONS);
const certificatesPermission = requireEventPermission(EVENT_PERMISSIONS.CERTIFICATES);

// Participant
router.post('/events/:id/registrations', authenticate, c.register);
router.post('/registrations/:id/cancel', authenticate, validate(v.registrationIdParam), c.cancelRegistration);
router.get('/me/registrations', authenticate, c.listMine);

// Organizer
router.get('/events/:id/registrations', authenticate, registrationsPermission, c.listForEvent);
router.post('/events/:id/registrations/approve', authenticate, registrationsPermission, validate(v.approveRules), c.approve);
router.post('/events/:id/registrations/reject', authenticate, registrationsPermission, validate(v.rejectRules), c.reject);
router.post('/events/:id/registrations/complete', authenticate, certificatesPermission, validate(v.completeRules), c.complete);

module.exports = router;