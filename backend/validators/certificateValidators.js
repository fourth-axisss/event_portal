const { body, param } = require('express-validator');
const { CERTIFICATE_TYPES } = require('../services/certificateService');

const issueRules = [
  body('type').isIn(CERTIFICATE_TYPES).withMessage(`Type must be one of: ${CERTIFICATE_TYPES.join(', ')}`),
  body('user_ids').optional().isArray({ max: 2000 }).withMessage('user_ids must be a list'),
  body('user_ids.*').isInt({ min: 1 }).withMessage('Invalid user id').toInt(),
  body('awards').optional().isArray({ max: 100 }).withMessage('awards must be a list'),
  body('awards.*.user_id').isInt({ min: 1 }).withMessage('Invalid user id in awards').toInt(),
  body('awards.*.rank_label').isString().trim().notEmpty().withMessage('Each award needs a rank, e.g. Winner')
    .isLength({ max: 50 }).withMessage('Rank can be at most 50 characters'),
];

const certificateIdRules = [param('id').isInt({ min: 1 }).withMessage('Invalid certificate id').toInt()];

module.exports = { issueRules, certificateIdRules };