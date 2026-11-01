const { body, param } = require('express-validator');

const idsRules = [
  body('registration_ids').isArray({ min: 1, max: 500 }).withMessage('Choose at least one registration'),
  body('registration_ids.*').isInt({ min: 1 }).withMessage('Invalid registration id').toInt(),
];

const approveRules = [...idsRules];

const rejectRules = [
  ...idsRules,
  body('reason').isString().trim().notEmpty().withMessage('Give a reason so the student knows why')
    .isLength({ max: 500 }).withMessage('Reason can be at most 500 characters'),
];

const completeRules = [
  ...idsRules,
  body('completed').isBoolean().withMessage('completed must be true or false').toBoolean(),
];

const registrationIdParam = [param('id').isInt({ min: 1 }).withMessage('Invalid registration id').toInt()];

module.exports = { approveRules, rejectRules, completeRules, registrationIdParam };