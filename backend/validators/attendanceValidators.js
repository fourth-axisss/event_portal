const { body, param } = require('express-validator');

const attendanceRules = [
  param('sessionId').isInt({ min: 1 }).withMessage('Invalid session id').toInt(),
  body('present_registration_ids').isArray({ max: 2000 }).withMessage('present_registration_ids must be a list'),
  body('present_registration_ids.*').isInt({ min: 1 }).withMessage('Invalid registration id').toInt(),
];

module.exports = { attendanceRules };