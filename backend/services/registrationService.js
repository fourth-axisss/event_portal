/*const pool = require('../db/pool');
const {
  ROLES,
  EVENT_KINDS,
  EVENT_STATUS,
  SEAT_TAKING_STATUSES,
  CLASH_STATUSES,
} = require('../config/constants');

// ---------- pure helpers ----------

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row[key])) map.set(row[key], []);
    map.get(row[key]).push(row);
  }
  return map;
}

// Is this role allowed to take part in events of this type? (admins never register)
function participates(user, participateRule) {
  if (user.role === ROLES.ADMIN) return false;
  return participateRule === 'both' || participateRule === user.role;
}

// Role rule + (students only) program/year grid + department list. Empty grid/list = open to all.
function checkEligibility(user, event, cells, departmentIds) {
  if (!participates(user, event.participate_rule)) return false;
  if (user.role !== ROLES.STUDENT) return true;
  const gridOk = cells.length === 0 || cells.some((c) => c.program === user.program && c.year === user.year);
  const departmentOk = departmentIds.length === 0 || departmentIds.includes(user.department_id);
  return gridOk && departmentOk;
}

// Two time ranges overlap if each starts before the other ends
function overlaps(a, b) {
  return a.start_time < b.end_time && b.start_time < a.end_time;
}

function isRegistrable(event) {
  return event.kind === EVENT_KINDS.NORMAL && Boolean(event.registration_required);
}

// ---------- flags for many events at once ----------

// Map eventId → { registration, eligible, clash_with, seats_taken } for this user
async function getUserFlags(user, events) {
  const flags = new Map();
  if (events.length === 0) return flags;
  const ids = events.map((e) => e.id);

  // 1. Seats taken (a team counts once, a solo registration counts once)
  const [seatRows] = await pool.query(
    `SELECT event_id,
            COUNT(DISTINCT COALESCE(CONCAT('t', team_id), CONCAT('r', id))) AS taken
       FROM registrations
      WHERE event_id IN (?) AND status IN (?)
      GROUP BY event_id`,
    [ids, SEAT_TAKING_STATUSES]
  );

  // 2 + 3. Eligibility grid and departments of all these events
  const [cellRows] = await pool.query('SELECT event_id, program, year FROM event_eligibility WHERE event_id IN (?)', [ids]);
  const [departmentRows] = await pool.query(
    'SELECT event_id, department_id FROM event_eligible_departments WHERE event_id IN (?)',
    [ids]
  );

  // 4. Everything this user has registered for, with times and the type's clash_check
  const [mine] = await pool.query(
    `SELECT r.id, r.event_id, r.status, r.rejection_reason,
            e.title, e.start_time, e.end_time, e.status AS event_status,
            COALESCE(t.clash_check, 0) AS clash_check
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       LEFT JOIN event_types t ON t.id = e.event_type_id
      WHERE r.user_id = ?`,
    [user.id]
  );

  const seatsByEvent = new Map(seatRows.map((r) => [r.event_id, r.taken]));
  const cellsByEvent = groupBy(cellRows, 'event_id');
  const departmentsByEvent = groupBy(departmentRows, 'event_id');
  const mineByEvent = new Map(mine.map((r) => [r.event_id, r]));
  const clashCandidates = mine.filter(
    (r) => CLASH_STATUSES.includes(r.status) && r.clash_check === 1 && r.event_status !== EVENT_STATUS.CANCELLED
  );

  for (const event of events) {
    const registrable = isRegistrable(event);
    const myRow = mineByEvent.get(event.id);
    const cells = cellsByEvent.get(event.id) || [];
    const departmentIds = (departmentsByEvent.get(event.id) || []).map((d) => d.department_id);

    const clashWith =
      registrable && event.clash_check === 1
        ? clashCandidates
            .filter((r) => r.event_id !== event.id && overlaps(r, event))
            .map((r) => ({ id: r.event_id, title: r.title }))
        : [];

    flags.set(event.id, {
      registration: myRow ? { id: myRow.id, status: myRow.status, rejection_reason: myRow.rejection_reason } : null,
      eligible: registrable ? checkEligibility(user, event, cells, departmentIds) : null,
      clash_with: clashWith,
      seats_taken: seatsByEvent.get(event.id) || 0,
    });
  }

  return flags;
}

module.exports = { participates, checkEligibility, overlaps, isRegistrable, getUserFlags };


*/




//After group 5 I have coded

const pool = require('../db/pool');
const HttpError = require('../utils/HttpError');
const { getEventPermissions } = require('./permissionService');
const {
  ROLES,
  EVENT_KINDS,
  EVENT_STATUS,
  EVENT_LIFECYCLE,
  EVENT_PERMISSIONS,
  REGISTRATION_STATUS,
  SEAT_TAKING_STATUSES,
  CLASH_STATUSES,
         
} = require('../config/constants');

const LIVE_STATUSES = CLASH_STATUSES; // pending, approved, confirmed

// ---------- pure helpers ----------

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row[key])) map.set(row[key], []);
    map.get(row[key]).push(row);
  }
  return map;
}

function participates(user, participateRule) {
  if (user.role === ROLES.ADMIN) return false;
  return participateRule === 'both' || participateRule === user.role;
}

function checkEligibility(user, event, cells, departmentIds) {
  if (!participates(user, event.participate_rule)) return false;
  if (user.role !== ROLES.STUDENT) return true;
  const gridOk = cells.length === 0 || cells.some((c) => c.program === user.program && c.year === user.year);
  const departmentOk = departmentIds.length === 0 || departmentIds.includes(user.department_id);
  return gridOk && departmentOk;
}

function overlaps(a, b) {
  return a.start_time < b.end_time && b.start_time < a.end_time;
}

function isRegistrable(event) {
  return event.kind === EVENT_KINDS.NORMAL && Boolean(event.registration_required);
}

// ---------- seats ----------

// Seats taken (a team counts once). lock: true → FOR SHARE, for use inside a transaction
async function countSeats(db, eventId, { lock = false } = {}) {
  const [[{ taken }]] = await db.query(
    `SELECT COUNT(DISTINCT COALESCE(CONCAT('t', team_id), CONCAT('r', id))) AS taken
       FROM registrations
      WHERE event_id = ? AND status IN (?)${lock ? ' FOR SHARE' : ''}`,
    [eventId, SEAT_TAKING_STATUSES]
  );
  return taken;
}

// ---------- flags for many events (badges, 4C) ----------

async function getUserFlags(user, events) {
  const flags = new Map();
  if (events.length === 0) return flags;
  const ids = events.map((e) => e.id);

  const [seatRows] = await pool.query(
    `SELECT event_id,
            COUNT(DISTINCT COALESCE(CONCAT('t', team_id), CONCAT('r', id))) AS taken
       FROM registrations
      WHERE event_id IN (?) AND status IN (?)
      GROUP BY event_id`,
    [ids, SEAT_TAKING_STATUSES]
  );
  const [cellRows] = await pool.query('SELECT event_id, program, year FROM event_eligibility WHERE event_id IN (?)', [ids]);
  const [departmentRows] = await pool.query(
    'SELECT event_id, department_id FROM event_eligible_departments WHERE event_id IN (?)',
    [ids]
  );
  const [mine] = await pool.query(
    `SELECT r.id, r.event_id, r.status, r.rejection_reason,
            e.title, e.start_time, e.end_time, e.status AS event_status,
            COALESCE(t.clash_check, 0) AS clash_check
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       LEFT JOIN event_types t ON t.id = e.event_type_id
      WHERE r.user_id = ?`,
    [user.id]
  );

  const seatsByEvent = new Map(seatRows.map((r) => [r.event_id, r.taken]));
  const cellsByEvent = groupBy(cellRows, 'event_id');
  const departmentsByEvent = groupBy(departmentRows, 'event_id');
  const mineByEvent = new Map(mine.map((r) => [r.event_id, r]));
  const clashCandidates = mine.filter(
    (r) => CLASH_STATUSES.includes(r.status) && r.clash_check === 1 && r.event_status !== EVENT_STATUS.CANCELLED
  );

  for (const event of events) {
    const registrable = isRegistrable(event);
    const myRow = mineByEvent.get(event.id);
    const cells = cellsByEvent.get(event.id) || [];
    const departmentIds = (departmentsByEvent.get(event.id) || []).map((d) => d.department_id);

    const clashWith =
      registrable && event.clash_check === 1
        ? clashCandidates
            .filter((r) => r.event_id !== event.id && overlaps(r, event))
            .map((r) => ({ id: r.event_id, title: r.title }))
        : [];

    flags.set(event.id, {
      registration: myRow ? { id: myRow.id, status: myRow.status, rejection_reason: myRow.rejection_reason } : null,
      eligible: registrable ? checkEligibility(user, event, cells, departmentIds) : null,
      clash_with: clashWith,
      seats_taken: seatsByEvent.get(event.id) || 0,
    });
  }

  return flags;
}

// ---------- register ----------

// The 9 checks, then the locked seat transaction. Returns { id, status } or throws HttpError.
async function register(user, eventId) {
  const [[event]] = await pool.query(
    `SELECT e.*, t.participate_rule, t.clash_check
       FROM v_events e
       LEFT JOIN event_types t ON t.id = e.event_type_id
      WHERE e.id = ?`,
    [eventId]
  );

  // 1–5: the event and who you are
  if (!event || event.status !== EVENT_STATUS.PUBLISHED) throw new HttpError(404, 'Event not found');
  if (!isRegistrable(event)) throw new HttpError(400, 'This event does not take registrations');
  if (event.lifecycle !== EVENT_LIFECYCLE.REGISTRATION_OPEN) throw new HttpError(409, 'Registration is closed');
  if (!participates(user, event.participate_rule)) {
    throw new HttpError(403, user.role === ROLES.ADMIN ? 'Admins cannot register for events' : `This event is not open to ${user.role}s`);
  }
   // Managers (owner, coordinator, fest leader) cannot also participate; delegates can
  if ((await getEventPermissions(user, event)).includes(EVENT_PERMISSIONS.MANAGE)) {
    throw new HttpError(403, 'You manage this event, so you cannot register for it');
  }

  // 6–9: the same flags the badges use
  const flags = (await getUserFlags(user, [event])).get(event.id);
  if (!flags.eligible) throw new HttpError(403, 'You are not eligible for this event');
  if (event.is_team_event) throw new HttpError(400, 'This is a team event. Register as a team.');
  const existing = flags.registration;
  if (existing && LIVE_STATUSES.includes(existing.status)) throw new HttpError(409, 'You are already registered');
  if (flags.clash_with.length > 0) {
    const titles = flags.clash_with.map((c) => c.title).join(', ');
    throw new HttpError(409, `This overlaps with ${titles}, which you are registered for`, { clash_with: flags.clash_with });
  }

  // 10: lock the event, count seats, save
  const conn = await pool.getConnection();
  let registrationId;
  let status;
  try {
    await conn.beginTransaction();

    const [[locked]] = await conn.query('SELECT capacity, fee, auto_approve FROM events WHERE id = ? FOR UPDATE', [eventId]);
    if (locked.capacity !== null && (await countSeats(conn, eventId, { lock: true })) >= locked.capacity) {
      throw new HttpError(409, 'Event is full');
    }

    if (!locked.auto_approve) status = REGISTRATION_STATUS.PENDING;
    else status = Number(locked.fee) > 0 ? REGISTRATION_STATUS.APPROVED : REGISTRATION_STATUS.CONFIRMED;

    if (existing) {
      // re-registering after a cancellation or rejection: reuse the row, clear old decisions
      await conn.query(
        `UPDATE registrations
            SET status = ?, registered_at = NOW(), rejection_reason = NULL,
                decided_by = NULL, decided_at = NULL, team_id = NULL,
                completed = 0, completion_marked_by = NULL, completion_marked_at = NULL
          WHERE id = ?`,
        [status, existing.id]
      );
      registrationId = existing.id;
    } else {
      const [result] = await conn.query('INSERT INTO registrations (event_id, user_id, status) VALUES (?, ?, ?)', [
        eventId,
        user.id,
        status,
      ]);
      registrationId = result.insertId;
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'You are already registered'); // double click race
    throw err;
  } finally {
    conn.release();
  }

  // Group 6: notify (bell + email) after commit
  return { id: registrationId, status, fee: event.fee, title: event.title };
}

module.exports = {
  participates,
  checkEligibility,
  overlaps,
  isRegistrable,
  countSeats,
  getUserFlags,
  register,
};