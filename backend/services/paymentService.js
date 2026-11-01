const crypto = require('crypto');
const pool = require('../db/pool');
const HttpError = require('../utils/HttpError');
const { EVENT_STATUS, EVENT_LIFECYCLE, REGISTRATION_STATUS } = require('../config/constants');

const PROVIDER = 'simulated'; // Tier 3: 'razorpay' — only this file changes

// Step 1: record an order for an approved, unpaid registration
async function createOrder(user, registrationId) {
  const [[row]] = await pool.query(
    `SELECT r.id, r.user_id, r.status, e.id AS event_id, e.title, e.fee, e.created_by, e.status AS event_status, e.lifecycle
       FROM registrations r
       JOIN v_events e ON e.id = r.event_id
      WHERE r.id = ?`,
    [registrationId]
  );
  if (!row || row.user_id !== user.id) throw new HttpError(404, 'Registration not found');
  if (row.status !== REGISTRATION_STATUS.APPROVED) throw new HttpError(409, 'There is nothing to pay for this registration');
  if (!(Number(row.fee) > 0)) throw new HttpError(409, 'This event is free');
  if (row.event_status === EVENT_STATUS.CANCELLED || row.lifecycle === EVENT_LIFECYCLE.COMPLETED) {
    throw new HttpError(409, 'This event is over or cancelled');
  }

  const orderId = `sim_order_${crypto.randomUUID()}`;
  const [result] = await pool.query(
    `INSERT INTO payments (registration_id, organizer_id, amount, provider, provider_order_id)
     VALUES (?, ?, ?, ?, ?)`,
    [row.id, row.created_by, row.fee, PROVIDER, orderId]
  );

  return { payment_id: result.insertId, order_id: orderId, amount: Number(row.fee), title: row.title, event_id: row.event_id };
}

// Step 3: record the result; on success confirm the registration in the same transaction
async function verifyPayment(user, paymentId, success) {
  const conn = await pool.getConnection();
  let outcome;
  try {
    await conn.beginTransaction();

    const [[row]] = await conn.query(
      `SELECT p.id, p.status, p.amount, r.id AS registration_id, r.user_id, r.status AS registration_status,
              e.id AS event_id, e.title
         FROM payments p
         JOIN registrations r ON r.id = p.registration_id
         JOIN events e ON e.id = r.event_id
        WHERE p.id = ?
          FOR UPDATE`,
      [paymentId]
    );
    if (!row || row.user_id !== user.id) throw new HttpError(404, 'Payment not found');
    if (row.status !== 'created') throw new HttpError(409, 'This payment was already processed');

    if (!success) {
      await conn.query("UPDATE payments SET status = 'failed' WHERE id = ?", [row.id]);
      outcome = { status: 'failed', event_id: row.event_id, title: row.title };
    } else {
      if (row.registration_status !== REGISTRATION_STATUS.APPROVED) {
        throw new HttpError(409, 'This registration can no longer be paid for');
      }
      const providerPaymentId = `sim_pay_${crypto.randomUUID()}`;
      await conn.query("UPDATE payments SET status = 'paid', provider_payment_id = ?, paid_at = NOW() WHERE id = ?", [
        providerPaymentId,
        row.id,
      ]);
      await conn.query('UPDATE registrations SET status = ? WHERE id = ?', [REGISTRATION_STATUS.CONFIRMED, row.registration_id]);
      outcome = { status: 'paid', event_id: row.event_id, title: row.title, amount: Number(row.amount) };
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'This registration is already paid');
    throw err;
  } finally {
    conn.release();
  }
  return outcome;
}

module.exports = { createOrder, verifyPayment };