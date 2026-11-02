const { body, param } = require('express-validator');
const { DELEGABLE_PERMISSIONS } = require('../config/constants');

const permissionsRules = [
  body('permissions').isArray({ min: 1 }).withMessage('Choose at least one thing they can help with'),
  body('permissions.*').isIn(DELEGABLE_PERMISSIONS).withMessage(`Permissions must be from: ${DELEGABLE_PERMISSIONS.join(', ')}`),
];

const delegationIdParam = param('delegationId').isInt({ min: 1 }).withMessage('Invalid delegation id').toInt();

const addRules = [body('user_id').isInt({ min: 1 }).withMessage('Choose a student').toInt(), ...permissionsRules];
const setPermissionsRules = [delegationIdParam, ...permissionsRules];
const revokeRules = [delegationIdParam];

module.exports = { addRules, setPermissionsRules, revokeRules };