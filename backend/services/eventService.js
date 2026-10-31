const pool = require('../db/pool');
const {
  EVENT_KINDS,
  EVENT_SCOPES,
  EVENT_STATUS,
  DEFAULT_MIN_ATTENDANCE_PERCENT,
  MAX_AUTO_SESSION_DAYS,
} = require('../config/constants');

// ---------- dates ----------

// '2026-11-20T18:00' or '2026-11-20 18:00[:ss]'  →  '2026-11-20 18:00:00'   (null if not a real date-time)
function toSqlDateTime(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const [, datePart, timePart] = match;
  const check = new Date(`${datePart}T${timePart}:00Z`);
  if (Number.isNaN(check.getTime())) return null;
  if (check.toISOString().slice(0, 16) !== `${datePart}T${timePart}`) return null; // e.g. 30 Feb rolled over
  return `${datePart} ${timePart}:00`;
}

function nextDay(dateText) {
  const d = new Date(`${dateText}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ---------- building and normalizing the row ----------

// Whitelist + defaults: only these columns can ever come from a request
function buildEventRow(body) {
  return normalizeEvent({
    kind: body.kind || EVENT_KINDS.NORMAL,
    scope: body.scope ?? null,
    event_type_id: body.event_type_id ?? null,
    fest_id: body.fest_id ?? null,
    club_id: body.club_id ?? null,
    parent_event_id: body.parent_event_id ?? null,
    title: body.title,
    description: body.description || null,
    venue_id: body.venue_id ?? null,
    start_time: body.start_time,
    end_time: body.end_time,
    registration_required: body.registration_required ?? true,
    registration_deadline: body.registration_deadline ?? null,
    capacity: body.capacity ?? null,
    fee: body.fee ?? 0,
    auto_approve: body.auto_approve ?? true,
    is_team_event: body.is_team_event ?? false,
    team_min: body.team_min ?? null,
    team_max: body.team_max ?? null,
    certificate_criteria: body.certificate_criteria ?? 'attendance',
    min_attendance_percent: body.min_attendance_percent ?? DEFAULT_MIN_ATTENDANCE_PERCENT,
  });
}

// Forced values that keep the row consistent with the CHECK constraints
function normalizeEvent(row) {
  if (row.kind === EVENT_KINDS.UMBRELLA) {
    row.scope = EVENT_SCOPES.FEST;
    row.event_type_id = null;
    row.club_id = null;
    row.parent_event_id = null;
    row.registration_required = false;
  }
  if (row.scope === EVENT_SCOPES.FACULTY) {
    row.fest_id = null;
    row.club_id = null;
    row.parent_event_id = null;
  }
  if (row.scope === EVENT_SCOPES.MULTI_CLUB || row.scope === EVENT_SCOPES.FEST) {
    row.club_id = null;
  }
  if (!row.registration_required) {
    row.registration_deadline = null;
    row.capacity = null;
    row.fee = 0;
    row.is_team_event = false;
    row.certificate_criteria = 'none';
  } else if (!row.registration_deadline) {
    row.registration_deadline = row.start_time;
  }
  if (!row.is_team_event) {
    row.team_min = null;
    row.team_max = null;
  }
  return row;
}

// ---------- rules that need the database ----------

// Returns an error message (400) or null when everything is fine
async function checkEventRules(row, { participatingClubIds = [], checkTypeActive = true } = {}) {
  if (row.end_time <= row.start_time) return 'End time must be after start time';
  if (row.registration_required && row.registration_deadline > row.end_time) {
    return 'Registration must close before the event ends';
  }
  if (row.is_team_event && (!row.team_min || !row.team_max || row.team_max < row.team_min)) {
    return 'Set a team size where minimum ≤ maximum';
  }

  // Event type: must exist, be offered, and fit who is organizing
  if (row.kind === EVENT_KINDS.NORMAL) {
    const [types] = await pool.query('SELECT name, organize_rule, is_active FROM event_types WHERE id = ?', [
      row.event_type_id,
    ]);
    const type = types[0];
    if (!type) return 'Choose an event type';
    if (checkTypeActive && !type.is_active) return `"${type.name}" events are no longer offered`;
    const organizer = row.scope === EVENT_SCOPES.FACULTY ? 'faculty' : 'student';
    if (type.organize_rule !== 'both' && type.organize_rule !== organizer) {
      return row.scope === EVENT_SCOPES.FACULTY
        ? `"${type.name}" events are organized by students, not as faculty events`
        : `"${type.name}" events can only be organized by faculty`;
    }
  }

  // Fest must be active
  if (row.fest_id) {
    const [fests] = await pool.query('SELECT 1 FROM fests WHERE id = ? AND is_active = 1', [row.fest_id]);
    if (!fests[0]) return 'Choose an active fest';
  }

  // Child of an umbrella: same fest, not cancelled, inside its dates
  if (row.parent_event_id) {
    const [parents] = await pool.query(
      'SELECT kind, status, fest_id, start_time, end_time, title FROM events WHERE id = ?',
      [row.parent_event_id]
    );
    const parent = parents[0];
    if (!parent || parent.kind !== EVENT_KINDS.UMBRELLA) return 'The parent must be an umbrella event';
    if (parent.status === EVENT_STATUS.CANCELLED) return `${parent.title} has been cancelled`;
    if (parent.fest_id !== row.fest_id) return `${parent.title} belongs to a different fest`;
    if (row.start_time < parent.start_time || row.end_time > parent.end_time) {
      return `The event must take place within ${parent.title} (${parent.start_time} to ${parent.end_time})`;
    }
  }

  // Multi-club: at least two active clubs of this fest
  if (row.scope === EVENT_SCOPES.MULTI_CLUB) {
    if (participatingClubIds.length < 2) return 'Choose at least two participating clubs';
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM clubs WHERE id IN (?) AND fest_id = ? AND is_active = 1',
      [participatingClubIds, row.fest_id]
    );
    if (total !== participatingClubIds.length) return 'All participating clubs must be active clubs of this fest';
  }

  return null;
}

// ---------- sessions ----------

function needsSessions(row) {
  return row.kind === EVENT_KINDS.NORMAL && Boolean(row.registration_required) && row.certificate_criteria !== 'completion';
}

// One session for a single day; one per day when the daily hours repeat; one long session otherwise
function buildDefaultSessions(start, end) {
  const startDate = start.slice(0, 10);
  const endDate = end.slice(0, 10);
  const startClock = start.slice(11);
  const endClock = end.slice(11);

  const single = [{ title: 'Session 1', start_time: start, end_time: end }];
  if (startDate === endDate || endClock <= startClock) return single;

  const sessions = [];
  for (let day = startDate, n = 1; day <= endDate; day = nextDay(day), n += 1) {
    if (n > MAX_AUTO_SESSION_DAYS) return single;
    sessions.push({ title: `Day ${n}`, start_time: `${day} ${startClock}`, end_time: `${day} ${endClock}` });
  }
  return sessions;
}

// ---------- side tables ----------

function unique(values) {
  return [...new Set(values)];
}

// { cells: [{program, year}], department_ids: [] } → duplicates removed (or undefined when not sent)
function normalizeEligibility(eligibility) {
  if (!eligibility) return undefined;
  const cellMap = new Map((eligibility.cells || []).map((c) => [`${c.program}-${c.year}`, c]));
  return {
    cells: [...cellMap.values()],
    departmentIds: unique(eligibility.department_ids || []),
  };
}

// Replace the participating clubs / eligibility sets of an event (create and edit)
async function saveEventLinks(conn, eventId, festId, { participatingClubIds, eligibility }) {
  if (participatingClubIds !== undefined) {
    await conn.query('DELETE FROM event_clubs WHERE event_id = ?', [eventId]);
    if (participatingClubIds.length > 0) {
      await conn.query('INSERT INTO event_clubs (event_id, fest_id, club_id) VALUES ?', [
        participatingClubIds.map((clubId) => [eventId, festId, clubId]),
      ]);
    }
  }

  if (eligibility !== undefined) {
    await conn.query('DELETE FROM event_eligibility WHERE event_id = ?', [eventId]);
    if (eligibility.cells.length > 0) {
      await conn.query('INSERT INTO event_eligibility (event_id, program, year) VALUES ?', [
        eligibility.cells.map((c) => [eventId, c.program, c.year]),
      ]);
    }
    await conn.query('DELETE FROM event_eligible_departments WHERE event_id = ?', [eventId]);
    if (eligibility.departmentIds.length > 0) {
      await conn.query('INSERT INTO event_eligible_departments (event_id, department_id) VALUES ?', [
        eligibility.departmentIds.map((departmentId) => [eventId, departmentId]),
      ]);
    }
  }
}

module.exports = {
  toSqlDateTime,
  buildEventRow,
  normalizeEvent,
  checkEventRules,
  needsSessions,
  buildDefaultSessions,
  unique,
  normalizeEligibility,
  saveEventLinks,
};