const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { requireEventPermission } = require('../middleware/requireEventPermission');
const { posterUpload, logoUpload, documentUpload } = require('../middleware/upload');
const { ROLES, EVENT_PERMISSIONS } = require('../config/constants');
const v = require('../validators/fileValidators');
const f = require('../controllers/fileController');

const router = express.Router();
const filesPermission = requireEventPermission(EVENT_PERMISSIONS.ANNOUNCEMENTS_FILES);
const adminOnly = [authenticate, authorize(ROLES.ADMIN)];

// Poster
router.post('/events/:id/poster', authenticate, filesPermission, posterUpload, f.setPoster);
router.delete('/events/:id/poster', authenticate, filesPermission, f.removePoster);

// Event files
router.post('/events/:id/files', authenticate, filesPermission, documentUpload, f.uploadEventFile);
router.patch('/events/:id/files/:fileId', authenticate, filesPermission, validate(v.renameRules), f.renameEventFile);
router.delete('/events/:id/files/:fileId', authenticate, filesPermission, validate(v.fileIdRules), f.deleteEventFile);
router.get('/files/:fileId/download', authenticate, f.downloadFile);

// Logos (admin)
router.post('/fests/:id/logo', adminOnly, logoUpload, f.setFestLogo);
router.post('/clubs/:id/logo', adminOnly, logoUpload, f.setClubLogo);

module.exports = router;