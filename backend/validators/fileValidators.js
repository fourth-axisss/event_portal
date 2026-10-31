const { body, param } = require('express-validator');

const fileIdParam = param('fileId').isInt({ min: 1 }).withMessage('Invalid file id').toInt();

const renameRules = [
  fileIdParam,
  body('title').isString().trim().notEmpty().withMessage('Title is required')
    .isLength({ max: 150 }).withMessage('Title can be at most 150 characters'),
];

const fileIdRules = [fileIdParam];

module.exports = { renameRules, fileIdRules };