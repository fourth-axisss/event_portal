const express = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const v = require('../validators/paymentValidators');
const c = require('../controllers/paymentController');

const router = express.Router();

router.post('/registrations/:id/payments', authenticate, validate(v.createOrderRules), c.startPayment);
router.post('/payments/:id/verify', authenticate, validate(v.verifyRules), c.finishPayment);

module.exports = router;