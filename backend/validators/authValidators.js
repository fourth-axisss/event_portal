const { body } = require('express-validator');

const loginRules = [
  body('email').trim().isEmail().withMessage('Enter a valid email'),
  body('password').isString().notEmpty().withMessage('Password is required'),
];

module.exports = { loginRules };