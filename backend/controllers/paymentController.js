const { createOrder, verifyPayment } = require('../services/paymentService');
const { notify } = require('../services/notificationService');

// POST /registrations/:id/payments
async function startPayment(req, res) {
  const order = await createOrder(req.user, req.params.id);
  res.status(201).json(order);
}

// POST /payments/:id/verify   { success }
async function finishPayment(req, res) {
  const outcome = await verifyPayment(req.user, req.params.id, req.body.success);
  const link = `/events/${outcome.event_id}`;

  if (outcome.status === 'paid') {
    await notify([req.user.id], `Payment of ₹${outcome.amount} received. You're confirmed for ${outcome.title}.`, link);
    return res.json({ status: 'paid', message: `Payment received. You're confirmed for ${outcome.title}.` });
  }
  await notify([req.user.id], `Your payment for ${outcome.title} did not go through. You can try again.`, link, { email: false });
  res.json({ status: 'failed', message: 'The payment did not go through. You can try again.' });
}

module.exports = { startPayment, finishPayment };