const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../config/constants');
const v = require('../validators/masterValidators');
const c = require('../controllers/masterController');

const router = express.Router();
const adminOnly = [authenticate, authorize(ROLES.ADMIN)];

router.get('/departments', authenticate, c.departments.list);
router.post('/departments', adminOnly, validate(v.departmentCreate), c.departments.create);
router.patch('/departments/:id', adminOnly, validate(v.departmentUpdate), c.departments.update);

router.get('/venues', authenticate, c.venues.list);
router.post('/venues', adminOnly, validate(v.venueCreate), c.venues.create);
router.patch('/venues/:id', adminOnly, validate(v.venueUpdate), c.venues.update);

router.get('/event-types', authenticate, c.eventTypes.list);
router.post('/event-types', adminOnly, validate(v.eventTypeCreate), c.eventTypes.create);
router.patch('/event-types/:id', adminOnly, validate(v.eventTypeUpdate), c.eventTypes.update);

router.get('/fests', authenticate, c.listFests);
router.post('/fests', adminOnly, validate(v.festCreate), c.fests.create);
router.patch('/fests/:id', adminOnly, validate(v.festUpdate), c.fests.update);

router.post('/clubs', adminOnly, validate(v.clubCreate), c.clubs.create);
router.patch('/clubs/:id', adminOnly, validate(v.clubUpdate), c.clubs.update);

router.get('/users/lookup', authenticate, validate(v.lookupRules), c.lookupUser);

module.exports = router;