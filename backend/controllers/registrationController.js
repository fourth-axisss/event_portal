const pool = require('../db/pool');
const HttpError = require('../utils/HttpError');
const { register: registerUser, countSeats } = require('../services/registrationService');
const { unique } = require('../services/eventService');
const {
  EVENT_STATUS,
  EVENT_LIFECYCLE,
  EVENT_PERMISSIONS,
  REGISTRATION_STATUS,
  CLASH_STATUSES,
} = require('../config/constants');

const LIVE_STATUSES = CLASH_STATUSES; // pending, approved, confirmed

// Latest payment status of a registration ('paid' wins over older failed attempts)
const PAYMENT_STATUS_SQL = `(SELECT p.status FROM payments p
                              WHERE p.registration_id = r.id
                              ORDER BY (p.status = 'paid') DESC, p.id DESC LIMIT 1)`;

function eventIsOver(event) {
  return event.status === EVENT_STATUS.CANCELLED || event.lifecycle === EVENT_LIFECYCLE.COMPLETED;
}

// Run an UPDATE on a list of registrations; roll back unless every one of them changed
async function updateAllOrNothing(conn, sql, params, expected, message) {
  const [result] = await conn.query(sql, params);
  if (result.affectedRows !== expected) throw new HttpError(409, message);
}

// ---------- participant ----------

// POST /events/:id/registrations
async function register(req, res) {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId < 1) return res.status(400).json({ message: 'Invalid event id' });

  const reg = await registerUser(req.user, eventId);

  const responses = {
    confirmed: { next: 'done', message: `You're registered for ${reg.title}.` },
    approved: { next: 'pay', message: `You're approved. Pay ₹${reg.fee} to confirm your seat.` },
    pending: { next: 'wait_for_approval', message: 'Request sent. The organizer will review it.' },
  };
  res.status(201).json({ ...responses[reg.status], registration: { id: reg.id, status: reg.status } });
}

// POST /registrations/:id/cancel — only your own, only before the event starts, not if paid
async function cancelRegistration(req, res) {
  const [[row]] = await pool.query(
    `SELECT r.id, r.user_id, r.status, e.lifecycle, ${PAYMENT_STATUS_SQL} AS payment_status
       FROM registrations r
       JOIN v_events e ON e.id = r.event_id
      WHERE r.id = ?`,
    [req.params.id]
  );
  if (!row || row.user_id !== req.user.id) return res.status(404).json({ message: 'Registration not found' });
  if (!LIVE_STATUSES.includes(row.status)) return res.status(409).json({ message: 'This registration is not active' });
  if (![EVENT_LIFECYCLE.REGISTRATION_OPEN, EVENT_LIFECYCLE.REGISTRATION_CLOSED].includes(row.lifecycle)) {
    return res.status(409).json({ message: 'The event has already started or ended' });
  }
  if (row.payment_status === 'paid') {
    return res.status(409).json({ message: 'You have already paid. Please contact the organizer.' });
  }

  await pool.query('UPDATE registrations SET status = ? WHERE id = ?', [REGISTRATION_STATUS.CANCELLED, row.id]);
  res.json({ message: 'Registration cancelled' });
}

// GET /me/registrations
async function listMine(req, res) {
  const [rows] = await pool.query(
    `SELECT r.id, r.status, r.rejection_reason, r.registered_at, r.completed,
            e.id AS event_id, e.title, e.start_time, e.end_time, e.lifecycle, e.status AS event_status,
            e.fee, e.certificate_criteria, e.min_attendance_percent, e.cancel_reason, e.poster_path,
            v.name AS venue_name,
            ${PAYMENT_STATUS_SQL} AS payment_status,
            (SELECT COUNT(*) FROM session_attendance sa WHERE sa.registration_id = r.id) AS sessions_attended,
            (SELECT COUNT(*) FROM event_sessions s WHERE s.event_id = e.id) AS sessions_total,
            EXISTS (SELECT 1 FROM feedback fb WHERE fb.event_id = e.id AND fb.user_id = r.user_id) AS feedback_given
       FROM registrations r
       JOIN v_events e ON e.id = r.event_id
       LEFT JOIN venues v ON v.id = e.venue_id
      WHERE r.user_id = ?
      ORDER BY e.start_time DESC`,
    [req.user.id]
  );

  const [certificates] = await pool.query(
    'SELECT id, event_id, type, rank_label, certificate_code FROM certificates WHERE user_id = ?',
    [req.user.id]
  );
  const certificatesByEvent = new Map();
  for (const c of certificates) {
    if (!certificatesByEvent.has(c.event_id)) certificatesByEvent.set(c.event_id, []);
    certificatesByEvent.get(c.event_id).push(c);
  }

  res.json(rows.map((r) => ({ ...r, certificates: certificatesByEvent.get(r.event_id) || [] })));
}

// ---------- organizer ----------

// GET /events/:id/registrations  (requires 'registrations')
async function listForEvent(req, res) {
  const event = req.event;
  const [rows] = await pool.query(
    `SELECT r.id, r.status, r.registered_at, r.rejection_reason, r.decided_at, r.completed,
            d.name AS decided_by_name,
            u.id AS user_id, u.name, u.roll_no, u.program, u.year, u.email, u.phone,
            dep.code AS department_code,
            ${PAYMENT_STATUS_SQL} AS payment_status
       FROM registrations r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN departments dep ON dep.id = u.department_id
       LEFT JOIN users d ON d.id = r.decided_by
      WHERE r.event_id = ?
      ORDER BY FIELD(r.status, 'pending', 'approved', 'confirmed', 'rejected', 'cancelled'), r.registered_at`,
    [event.id]
  );

  // Contact details are only for people who fully manage the event
  const showContact = req.eventPermissions.includes(EVENT_PERMISSIONS.MANAGE);
  const registrations = showContact ? rows : rows.map(({ email, phone, ...rest }) => rest);

  const counts = {};
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;

  res.json({
    capacity: event.capacity,
    seats_taken: await countSeats(pool, event.id),
    fee: event.fee,
    auto_approve: event.auto_approve,
    certificate_criteria: event.certificate_criteria,
    counts,
    registrations,
  });
}

// POST /events/:id/registrations/approve   { registration_ids }
async function approve(req, res) {
  const event = req.event;
  if (eventIsOver(event)) return res.status(409).json({ message: 'This event is over or cancelled' });
  const ids = unique(req.body.registration_ids);

  const conn = await pool.getConnection();
  let newStatus;
  try {
    await conn.beginTransaction();

    const [[locked]] = await conn.query('SELECT capacity, fee FROM events WHERE id = ? FOR UPDATE', [event.id]);
    if (locked.capacity !== null) {
      const free = locked.capacity - (await countSeats(conn, event.id, { lock: true }));
      if (ids.length > free) {
        throw new HttpError(409, free > 0 ? `Only ${free} seat(s) left. Approve fewer people.` : 'The event is full');
      }
    }

    newStatus = Number(locked.fee) > 0 ? REGISTRATION_STATUS.APPROVED : REGISTRATION_STATUS.CONFIRMED;
    await updateAllOrNothing(
      conn,
      `UPDATE registrations SET status = ?, decided_by = ?, decided_at = NOW()
        WHERE id IN (?) AND event_id = ? AND status = ?`,
      [newStatus, req.user.id, ids, event.id, REGISTRATION_STATUS.PENDING],
      ids.length,
      'Some of these are no longer pending. Refresh and try again.'
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Group 6: notify each person after commit
  res.json({ message: `${ids.length} approved`, status: newStatus });
}

// POST /events/:id/registrations/reject   { registration_ids, reason }
async function reject(req, res) {
  const event = req.event;
  if (eventIsOver(event)) return res.status(409).json({ message: 'This event is over or cancelled' });
  const ids = unique(req.body.registration_ids);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await updateAllOrNothing(
      conn,
      `UPDATE registrations r
          SET r.status = ?, r.rejection_reason = ?, r.decided_by = ?, r.decided_at = NOW()
        WHERE r.id IN (?) AND r.event_id = ?
          AND (r.status = ?
               OR (r.status = ? AND NOT EXISTS (SELECT 1 FROM payments p
                                                 WHERE p.registration_id = r.id AND p.status = 'paid')))`,
      [
        REGISTRATION_STATUS.REJECTED,
        req.body.reason,
        req.user.id,
        ids,
        event.id,
        REGISTRATION_STATUS.PENDING,
        REGISTRATION_STATUS.APPROVED,
      ],
      ids.length,
      'Only pending registrations (or approved ones not yet paid) can be rejected. Refresh and try again.'
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Group 6: notify each person after commit
  res.json({ message: `${ids.length} rejected` });
}

// POST /events/:id/registrations/complete   { registration_ids, completed }  (requires 'certificates')
async function complete(req, res) {
  const event = req.event;
  if (event.certificate_criteria !== 'completion') {
    return res.status(409).json({ message: 'This event gives certificates by attendance, not by completion' });
  }
  const ids = unique(req.body.registration_ids);
  const done = req.body.completed;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await updateAllOrNothing(
      conn,
      `UPDATE registrations
          SET completed = ?, completion_marked_by = ?, completion_marked_at = ?
        WHERE id IN (?) AND event_id = ? AND status = ?`,
      [done ? 1 : 0, done ? req.user.id : null, done ? new Date() : null, ids, event.id, REGISTRATION_STATUS.CONFIRMED],
      ids.length,
      'Only confirmed participants can be marked complete'
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  res.json({ message: done ? `${ids.length} marked complete` : `${ids.length} unmarked` });
}

module.exports = { register, cancelRegistration, listMine, listForEvent, approve, reject, complete };