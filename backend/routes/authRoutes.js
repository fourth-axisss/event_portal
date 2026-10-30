const express = require('express');
const validate = require('../middleware/validate');
const { loginRules } = require('../validators/authValidators');
const { login } = require('../controllers/authController');

const router = express.Router();

router.post('/auth/login', validate(loginRules), login);

module.exports = router;