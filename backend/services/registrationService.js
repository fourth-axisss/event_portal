const pool = require('../db/pool');
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