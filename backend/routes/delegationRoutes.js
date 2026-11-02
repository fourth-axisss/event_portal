const express = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { requireEventPermission } = require('../middleware/requireEventPermission');
const { EVENT_PERMISSIONS } = require('../config/constants');
const v = require('../validators/delegationValidators');
const c = require('../controllers/delegationController');

const router = express.Router();
const manage = requireEventPermission(EVENT_PERMISSIONS.MANAGE);

router.get('/events/:id/delegates', authenticate, manage, c.list);
router.post('/events/:id/delegates', authenticate, manage, validate(v.addRules), c.add);
router.put('/events/:id/delegates/:delegationId/permissions', authenticate, manage, validate(v.setPermissionsRules), c.setPermissions);
router.post('/events/:id/delegates/:delegationId/revoke', authenticate, manage, validate(v.revokeRules), c.revoke);

module.exports = router;