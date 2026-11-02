/*const pool = require('../db/pool');
const HttpError = require('../utils/HttpError');
const { register: registerUser, countSeats } = require('../services/registrationService');
const { unique } = require('../services/eventService');
const { notify } = require('../services/notificationService');
const {
  EVENT_STATUS,
  EVENT_LIFECYCLE,
  EVENT_PERMISSIONS,
  REGISTRATION_STATUS,
  CLASH_STATUSES,
} = require('../config/constants');

const LIVE_STATUSES = CLASH_STATUSES; // pending, approved, confirmed

const PAYMENT_STATUS_SQL = `(SELECT p.status FROM payments p
                              WHERE p.registration_id = r.id
                              ORDER BY (p.status = 'paid') DESC, p.id DESC LIMIT 1)`;

function eventIsOver(event) {
  return event.status === EVENT_STATUS.CANCELLED || event.lifecycle === EVENT_LIFECYCLE.COMPLETED;
}

async function updateAllOrNothing(conn, sql, params, expected, message) {
  const [result] = await conn.query(sql, params);
  if (result.affectedRows !== expected) throw new HttpError(409, message);
}

async function userIdsOf(registrationIds) {
  const [rows] = await pool.query('SELECT user_id FROM registrations WHERE id IN (?)', [registrationIds]);
  return rows.map((r) => r.user_id);
}



//Delegate cant 
async function refuseSelfAction(req, ids, action) {
  if (req.eventPermissions.includes(EVENT_PERMISSIONS.MANAGE)) return;
  const [[own]] = await pool.query('SELECT id FROM registrations WHERE event_id = ? AND user_id = ?', [
    req.event.id,
    req.user.id,
  ]);
  if (own && ids.includes(own.id)) {
    throw new HttpError(403, `You cannot ${action} your own registration. Ask an event manager.`);
  }
}
// ---------- participant ----------

// POST /events/:id/registrations
async function register(req, res) {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId < 1) return res.status(400).json({ message: 'Invalid event id' });

  const reg = await registerUser(req.user, eventId);

  const responses = {
    confirmed: { next: 'done', message: `You're registered for ${reg.title}.` },
    approved: { next: 'pay', message: `You're approved for ${reg.title}. Pay ₹${reg.fee} to confirm your seat.` },
    pending: { next: 'wait_for_approval', message: `Your request for ${reg.title} was sent. The organizer will review it.` },
  };
  const reply = responses[reg.status];

  await notify([req.user.id], reply.message, `/events/${eventId}`, { email: reg.status !== 'pending' });
  res.status(201).json({ ...reply, registration: { id: reg.id, status: reg.status } });
}

// POST /registrations/:id/cancel
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

*/








const pool = require('../db/pool');
const HttpError = require('../utils/HttpError');
const { register: registerUser, countSeats } = require('../services/registrationService');
const { unique } = require('../services/eventService');
const { notify } = require('../services/notificationService');
const { releaseTeam } = require('./teamController');
const {
  EVENT_STATUS,
  EVENT_LIFECYCLE,
  EVENT_PERMISSIONS,
  REGISTRATION_STATUS,
  CLASH_STATUSES,
} = require('../config/constants');

const LIVE_STATUSES = CLASH_STATUSES; // pending, approved, confirmed

const PAYMENT_STATUS_SQL = `(SELECT p.status FROM payments p
                              WHERE p.registration_id = r.id
                              ORDER BY (p.status = 'paid') DESC, p.id DESC LIMIT 1)`;

function eventIsOver(event) {
  return event.status === EVENT_STATUS.CANCELLED || event.lifecycle === EVENT_LIFECYCLE.COMPLETED;
}

async function updateAllOrNothing(conn, sql, params, expected, message) {
  const [result] = await conn.query(sql, params);
  if (result.affectedRows !== expected) throw new HttpError(409, message);
}

async function userIdsOf(registrationIds) {
  const [rows] = await pool.query('SELECT user_id FROM registrations WHERE id IN (?)', [registrationIds]);
  return rows.map((r) => r.user_id);
}

// Ticking one team member selects the whole team
async function expandTeams(eventId, ids) {
  const [rows] = await pool.query(
    `SELECT r2.id
       FROM registrations r1
       JOIN registrations r2 ON r2.team_id = r1.team_id AND r2.event_id = r1.event_id
      WHERE r1.id IN (?) AND r1.event_id = ? AND r1.team_id IS NOT NULL`,
    [ids, eventId]
  );
  return unique([...ids, ...rows.map((r) => r.id)]);
}

// How many seats these registrations need (a team counts once)
async function seatUnits(ids) {
  const [[{ units }]] = await pool.query(
    "SELECT COUNT(DISTINCT COALESCE(CONCAT('t', team_id), CONCAT('r', id))) AS units FROM registrations WHERE id IN (?)",
    [ids]
  );
  return units;
}

// A delegate (no 'manage') may not act on their own registration
async function refuseSelfAction(req, ids, action) {
  if (req.eventPermissions.includes(EVENT_PERMISSIONS.MANAGE)) return;
  const [[own]] = await pool.query('SELECT id FROM registrations WHERE event_id = ? AND user_id = ?', [
    req.event.id,
    req.user.id,
  ]);
  if (own && ids.includes(own.id)) {
    throw new HttpError(403, `You cannot ${action} your own registration. Ask an event manager.`);
  }
}

// ---------- participant ----------

// POST /events/:id/registrations
async function register(req, res) {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId < 1) return res.status(400).json({ message: 'Invalid event id' });

  const reg = await registerUser(req.user, eventId);

  const responses = {
    confirmed: { next: 'done', message: `You're registered for ${reg.title}.` },
    approved: { next: 'pay', message: `You're approved for ${reg.title}. Pay ₹${reg.fee} to confirm your seat.` },
    pending: { next: 'wait_for_approval', message: `Your request for ${reg.title} was sent. The organizer will review it.` },
  };
  const reply = responses[reg.status];

  await notify([req.user.id], reply.message, `/events/${eventId}`, { email: reg.status !== 'pending' });
  res.status(201).json({ ...reply, registration: { id: reg.id, status: reg.status } });
}

// POST /registrations/:id/cancel — your own; for a team, only the leader, and it cancels the whole team
async function cancelRegistration(req, res) {
  const [[row]] = await pool.query(
    `SELECT r.id, r.user_id, r.status, r.team_id, e.id AS event_id, e.title, e.lifecycle,
            ${PAYMENT_STATUS_SQL} AS payment_status
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

  if (!row.team_id) {
    await pool.query('UPDATE registrations SET status = ? WHERE id = ?', [REGISTRATION_STATUS.CANCELLED, row.id]);
    return res.json({ message: 'Registration cancelled' });
  }

  // Team registration: the leader cancels it for everyone
  const [[team]] = await pool.query('SELECT leader_id, name FROM teams WHERE id = ?', [row.team_id]);
  if (team.leader_id !== req.user.id) {
    return res.status(403).json({ message: 'Only the team leader can cancel the team registration' });
  }
  const [members] = await pool.query('SELECT user_id FROM registrations WHERE team_id = ? AND status IN (?)', [row.team_id, LIVE_STATUSES]);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE registrations SET status = ? WHERE team_id = ? AND status IN (?)', [
      REGISTRATION_STATUS.CANCELLED,
      row.team_id,
      LIVE_STATUSES,
    ]);
    await releaseTeam(conn, row.team_id);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await notify(
    members.map((m) => m.user_id).filter((id) => id !== req.user.id),
    `${req.user.name} cancelled team ${team.name}'s registration for ${row.title}`,
    `/events/${row.event_id}`
  );
  res.json({ message: `Team ${team.name}'s registration was cancelled` });
}

// GET /me/registrations
async function listMine(req, res) {
  const [rows] = await pool.query(
    `SELECT r.id, r.status, r.rejection_reason, r.registered_at, r.completed,
            e.id AS event_id, e.title, e.start_time, e.end_time, e.lifecycle, e.status AS event_status,
            e.fee, e.certificate_criteria, e.min_attendance_percent, e.cancel_reason, e.poster_path,
            v.name AS venue_name,
            tm.name AS team_name, (tm.leader_id = r.user_id) AS is_team_leader,
            ${PAYMENT_STATUS_SQL} AS payment_status,
            (SELECT COUNT(*) FROM session_attendance sa WHERE sa.registration_id = r.id) AS sessions_attended,
            (SELECT COUNT(*) FROM event_sessions s WHERE s.event_id = e.id) AS sessions_total,
            EXISTS (SELECT 1 FROM feedback fb WHERE fb.event_id = e.id AND fb.user_id = r.user_id) AS feedback_given
       FROM registrations r
       JOIN v_events e ON e.id = r.event_id
       LEFT JOIN venues v ON v.id = e.venue_id
       LEFT JOIN teams tm ON tm.id = r.team_id
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

// GET /events/:id/registrations
async function listForEvent(req, res) {
  const event = req.event;
  const [rows] = await pool.query(
    `SELECT r.id, r.status, r.registered_at, r.rejection_reason, r.decided_at, r.completed,
            d.name AS decided_by_name, tm.name AS team_name,
            u.id AS user_id, u.name, u.roll_no, u.program, u.year, u.email, u.phone,
            dep.code AS department_code,
            ${PAYMENT_STATUS_SQL} AS payment_status
       FROM registrations r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN departments dep ON dep.id = u.department_id
       LEFT JOIN users d ON d.id = r.decided_by
       LEFT JOIN teams tm ON tm.id = r.team_id
      WHERE r.event_id = ?
      ORDER BY FIELD(r.status, 'pending', 'approved', 'confirmed', 'rejected', 'cancelled'), tm.name, r.registered_at`,
    [event.id]
  );

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
    is_team_event: event.is_team_event,
    counts,
    registrations,
  });
}

// POST /events/:id/registrations/approve   { registration_ids }
async function approve(req, res) {
  const event = req.event;
  if (eventIsOver(event)) return res.status(409).json({ message: 'This event is over or cancelled' });
  const ids = await expandTeams(event.id, unique(req.body.registration_ids));
  await refuseSelfAction(req, ids, 'approve');
  const units = await seatUnits(ids);

  const conn = await pool.getConnection();
  let newStatus;
  try {
    await conn.beginTransaction();

    const [[locked]] = await conn.query('SELECT capacity, fee FROM events WHERE id = ? FOR UPDATE', [event.id]);
    if (locked.capacity !== null) {
      const free = locked.capacity - (await countSeats(conn, event.id, { lock: true }));
      if (units > free) {
        throw new HttpError(409, free > 0 ? `Only ${free} seat(s) left. Approve fewer.` : 'The event is full');
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

  const message =
    newStatus === REGISTRATION_STATUS.CONFIRMED
      ? `You're in! Your registration for ${event.title} was approved.`
      : `Your registration for ${event.title} was approved. Pay ₹${event.fee} to confirm${event.is_team_event ? ' (the team leader pays)' : ''}.`;
  await notify(await userIdsOf(ids), message, `/events/${event.id}`);

  res.json({ message: `${ids.length} approved`, status: newStatus });
}

// POST /events/:id/registrations/reject   { registration_ids, reason }
async function reject(req, res) {
  const event = req.event;
  if (eventIsOver(event)) return res.status(409).json({ message: 'This event is over or cancelled' });
  const ids = await expandTeams(event.id, unique(req.body.registration_ids));
  await refuseSelfAction(req, ids, 'reject');

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

  await notify(
    await userIdsOf(ids),
    `Your registration for ${event.title} was not approved: ${req.body.reason}`,
    `/events/${event.id}`
  );
  res.json({ message: `${ids.length} rejected` });
}

// POST /events/:id/registrations/complete   { registration_ids, completed }
async function complete(req, res) {
  const event = req.event;
  if (event.certificate_criteria !== 'completion') {
    return res.status(409).json({ message: 'This event gives certificates by attendance, not by completion' });
  }
  const ids = unique(req.body.registration_ids);
  const done = req.body.completed;
  await refuseSelfAction(req, ids, 'mark completion on');

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



























/*

// ---------- organizer ----------

// GET /events/:id/registrations
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
  await refuseSelfAction(req, ids, 'approve');

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

  const message =
    newStatus === REGISTRATION_STATUS.CONFIRMED
      ? `You're in! Your registration for ${event.title} was approved.`
      : `Your registration for ${event.title} was approved. Pay ₹${event.fee} to confirm your seat.`;
  await notify(await userIdsOf(ids), message, `/events/${event.id}`);

  res.json({ message: `${ids.length} approved`, status: newStatus });
}

// POST /events/:id/registrations/reject   { registration_ids, reason }
async function reject(req, res) {
  const event = req.event;
  if (eventIsOver(event)) return res.status(409).json({ message: 'This event is over or cancelled' });
    const ids = unique(req.body.registration_ids);
  await refuseSelfAction(req, ids, 'reject');

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

  await notify(
    await userIdsOf(ids),
    `Your registration for ${event.title} was not approved: ${req.body.reason}`,
    `/events/${event.id}`
  );
  res.json({ message: `${ids.length} rejected` });
}

// POST /events/:id/registrations/complete   { registration_ids, completed }
async function complete(req, res) {
  const event = req.event;
  if (event.certificate_criteria !== 'completion') {
    return res.status(409).json({ message: 'This event gives certificates by attendance, not by completion' });
  }
    const ids = unique(req.body.registration_ids);
  const done = req.body.completed;
  await refuseSelfAction(req, ids, 'mark completion on');

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


*/

























