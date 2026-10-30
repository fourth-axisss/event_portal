const { validationResult } = require('express-validator');

function validate(rules) {
  return [
    ...rules,
    (req, res, next) => {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        return res.status(400).json({
          message: 'Invalid input',
          errors: result.array().map((e) => ({ field: e.path, msg: e.msg })),
        });
      }
      next();
    },
  ];
}

module.exports = validate;