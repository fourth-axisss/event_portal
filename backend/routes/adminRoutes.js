const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../config/constants');
const v = require('../validators/adminValidators');
const a = require('../controllers/adminController');
const p = require('../controllers/positionController');

const router = express.Router();

// Every /admin/... URL needs a logged-in admin
router.use('/admin', authenticate, authorize(ROLES.ADMIN));

router.get('/admin/users', validate(v.listUsersRules), a.listUsers);
router.post('/admin/users', validate(v.userCreate), a.createUser);
router.patch('/admin/users/:id', validate(v.userUpdate), a.updateUser);
router.post('/admin/users/:id/reset-password', validate(v.resetPasswordRules), a.resetPassword);

router.put('/admin/fests/:festId/holders/:positionType', validate(v.holderRules), p.setFestHolder);
router.post('/admin/clubs/:clubId/coordinators', validate(v.coordinatorRules), p.addClubCoordinator);
router.delete('/admin/positions/:id', validate(v.positionIdRules), p.removePosition);

module.exports = router;