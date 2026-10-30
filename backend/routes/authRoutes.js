const express = require('express');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { loginRules } = require('../validators/authValidators');
const { login, getMe } = require('../controllers/authController');

const router = express.Router();

router.post('/auth/login', validate(loginRules), login);
router.get('/auth/me', authenticate, getMe);

module.exports = router;