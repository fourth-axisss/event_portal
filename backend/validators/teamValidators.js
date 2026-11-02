const { body, param } = require('express-validator');

const createTeamRules = [
  body('name').isString().trim().notEmpty().withMessage('Give your team a name')
    .isLength({ max: 60 }).withMessage('Team name can be at most 60 characters'),
];

const inviteRules = [
  body('roll_no').isString().trim().notEmpty().withMessage('Enter a roll number').toUpperCase(),
];

const memberParam = [param('userId').isInt({ min: 1 }).withMessage('Invalid user id').toInt()];

module.exports = { createTeamRules, inviteRules, memberParam };