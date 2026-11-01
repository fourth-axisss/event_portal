const { body } = require('express-validator');

const feedbackRules = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1 to 5').toInt(),
  body('comment').optional({ values: 'falsy' }).isString().trim()
    .isLength({ max: 1000 }).withMessage('Comment can be at most 1000 characters'),
];

module.exports = { feedbackRules };