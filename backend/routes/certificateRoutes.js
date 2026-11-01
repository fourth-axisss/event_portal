const express = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { requireEventPermission } = require('../middleware/requireEventPermission');
const { EVENT_PERMISSIONS } = require('../config/constants');
const v = require('../validators/certificateValidators');
const c = require('../controllers/certificateController');

const router = express.Router();
const certificatesPermission = requireEventPermission(EVENT_PERMISSIONS.CERTIFICATES);

router.get('/events/:id/certificates', authenticate, certificatesPermission, c.listForEvent);
router.post('/events/:id/certificates/issue', authenticate, certificatesPermission, validate(v.issueRules), c.issue);
router.delete('/certificates/:id', authenticate, validate(v.certificateIdRules), c.revoke);
router.get('/me/certificates', authenticate, c.listMine);
router.get('/certificates/:id/pdf', authenticate, validate(v.certificateIdRules), c.downloadPdf);

module.exports = router;