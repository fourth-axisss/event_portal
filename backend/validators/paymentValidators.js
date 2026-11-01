const { body, param } = require('express-validator');

const createOrderRules = [param('id').isInt({ min: 1 }).withMessage('Invalid registration id').toInt()];

const verifyRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid payment id').toInt(),
  body('success').isBoolean().withMessage('success must be true or false').toBoolean(),
];

module.exports = { createOrderRules, verifyRules };