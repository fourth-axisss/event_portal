const { body, param, query } = require('express-validator');
const { ROLES, PROGRAMS, PROGRAM_MAX_YEAR, POSITION_TYPES } = require('../config/constants');

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id').toInt();
const userIdRule = body('user_id').isInt({ min: 1 }).withMessage('Choose a student').toInt();

const nameRule = (optional) => {
  const chain = optional ? body('name').optional() : body('name');
  return chain.isString().trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name can be at most 100 characters');
};
const emailRule = (optional) => {
  const chain = optional ? body('email').optional() : body('email');
  return chain.trim().isEmail().withMessage('Enter a valid email')
    .isLength({ max: 150 }).withMessage('Email can be at most 150 characters').toLowerCase();
};

const studentFieldRules = [
  body('phone').optional({ values: 'falsy' }).isString().trim()
    .isLength({ max: 15 }).withMessage('Phone can be at most 15 characters'),
  body('department_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Invalid department').toInt(),
  body('roll_no').optional({ values: 'falsy' }).isString().trim()
    .isLength({ max: 20 }).withMessage('Roll no. can be at most 20 characters').toUpperCase(),
  body('program').optional({ values: 'falsy' }).isIn(PROGRAMS).withMessage(`Program must be one of: ${PROGRAMS.join(', ')}`),
  body('year').optional({ values: 'falsy' }).isInt({ min: 1, max: 5 }).withMessage('Year must be 1 to 5').toInt(),
];

// Whole-body check: what a student must have, and program/year combinations
function studentRules(b) {
  if (b.role !== ROLES.STUDENT) return true;
  const missing = ['roll_no', 'department_id', 'program', 'year'].filter((f) => !b[f]);
  if (missing.length > 0) {
    throw new Error(`Students need: ${missing.join(', ')}`);
  }
  if (b.year > PROGRAM_MAX_YEAR[b.program]) {
    throw new Error(`${b.program} has only ${PROGRAM_MAX_YEAR[b.program]} years`);
  }
  return true;
}

const userCreate = [
  body('role').isIn(Object.values(ROLES)).withMessage('Role must be student, faculty or admin'),
  nameRule(false),
  emailRule(false),
  body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ...studentFieldRules,
  body().custom(studentRules),
];

const userUpdate = [
  idParam,
  nameRule(true),
  emailRule(true),
  ...studentFieldRules,
  body('is_active').optional().isBoolean().withMessage('Active must be true or false').toBoolean(),
];

const listUsersRules = [
  query('role').optional().isIn(Object.values(ROLES)).withMessage('Unknown role'),
  query('is_active').optional().isIn(['0', '1']).withMessage('is_active must be 0 or 1'),
];

const resetPasswordRules = [
  idParam,
  body('new_password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const holderRules = [
  param('festId').isInt({ min: 1 }).withMessage('Invalid fest id').toInt(),
  param('positionType').isIn([POSITION_TYPES.FEST_HEAD, POSITION_TYPES.GSEC])
    .withMessage('Position must be fest_head or gsec'),
  userIdRule,
];

const coordinatorRules = [
  param('clubId').isInt({ min: 1 }).withMessage('Invalid club id').toInt(),
  userIdRule,
];

const positionIdRules = [idParam];
const eventCreatorAddRules = [userIdRule];
const eventCreatorRemoveRules = [param('userId').isInt({ min: 1 }).withMessage('Invalid user id').toInt()];

module.exports = {
  userCreate,
  userUpdate,
  listUsersRules,
  resetPasswordRules,
  holderRules,
  coordinatorRules,
  positionIdRules,
  eventCreatorAddRules,
  eventCreatorRemoveRules,
};