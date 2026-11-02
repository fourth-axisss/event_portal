const express = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const v = require('../validators/teamValidators');
const c = require('../controllers/teamController');

const router = express.Router();

router.post('/events/:id/teams', authenticate, validate(v.createTeamRules), c.createTeam);
router.get('/me/teams', authenticate, c.listMine);
router.post('/teams/:id/members', authenticate, validate(v.inviteRules), c.invite);
router.delete('/teams/:id/members/:userId', authenticate, validate(v.memberParam), c.removeMember);
router.post('/teams/:id/accept', authenticate, c.accept);
router.post('/teams/:id/decline', authenticate, c.decline);
router.post('/teams/:id/submit', authenticate, c.submit);
router.post('/teams/:id/cancel', authenticate, c.cancelTeam);

module.exports = router;