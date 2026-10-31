const pool = require('../db/pool');
const {
  ROLES,
  POSITION_TYPES,
  EVENT_KINDS,
  EVENT_SCOPES,
  EVENT_STATUS,
  DELEGATION_EXPIRY_DAYS,
} = require('../config/constants');
const { getUserPositions, holdsInFest, coordinatesClub, canCreate } = require('../services/permissionService');
const {
  buildEventRow,
  checkEventRules,
  needsSessions,
  buildDefaultSessions,
  unique,
  normalizeEligibility,
  saveEventLinks,
} = require('../services/eventService');

const { FEST_HEAD, GSEC, FEST_EVENT_CREATOR } = POSITION_TYPES;

function badRequest(res, message) {
  return res.status(400).json({ message });
}

// GET /organize/event-form-options — what this user may choose on the Create Event form
async function getFormOptions(req, res) {
  const user = req.user;
  const isAdmin = user.role === ROLES.ADMIN;
  const positions = isAdmin ? [] : await getUserPositions(user.id);

  const [festRows] = await pool.query('SELECT id, name FROM fests WHERE is_active = 1 ORDER BY name');
  const [clubRows] = await pool.query('SELECT id, fest_id, name FROM clubs WHERE is_active = 1 ORDER BY name');
  const [umbrellaRows] = await pool.query(
    `SELECT id, fest_id, title, start_time, end_time, status
       FROM events WHERE kind = ? AND status <> ? ORDER BY start_time`,
    [EVENT_KINDS.UMBRELLA, EVENT_STATUS.CANCELLED]
  );
  const [typeRows] = await pool.query(
    'SELECT id, name, organize_rule, participate_rule, clash_check FROM event_types WHERE is_active = 1 ORDER BY name'
  );

  const fests = festRows
    .map((fest) => {
      const leads = isAdmin || holdsInFest(positions, fest.id, [FEST_HEAD, GSEC]);
      const createsFestLevel = leads || holdsInFest(positions, fest.id, [FEST_EVENT_CREATOR]);
      const festClubs = clubRows.filter((c) => c.fest_id === fest.id).map((c) => ({ id: c.id, name: c.name }));
      return {
        id: fest.id,
        name: fest.name,
        can_create_fest_level: createsFestLevel,
        can_create_umbrella: leads,
        clubs: leads ? festClubs : festClubs.filter((c) => coordinatesClub(positions, c.id)),
        all_clubs: createsFestLevel ? festClubs : [],
        umbrellas: umbrellaRows.filter((u) => u.fest_id === fest.id),
      };
    })
    .filter((f) => f.can_create_fest_level || f.clubs.length > 0);

  const allowedRules =
    isAdmin ? ['faculty', 'student', 'both'] : user.role === ROLES.FACULTY ? ['faculty', 'both'] : ['student', 'both'];

  res.json({
    can_create_faculty_event: isAdmin || user.role === ROLES.FACULTY,
    fests,
    event_types: typeRows.filter((t) => allowedRules.includes(t.organize_rule)),
  });
}

// GET /organize/events — every event this user can manage (the permission chain as one query)
async function listMyEvents(req, res) {
  const id = req.user.id;
  const isAdmin = req.user.role === ROLES.ADMIN ? 1 : 0;

  const [rows] = await pool.query(
    `SELECT e.id, e.title, e.kind, e.scope, e.status, e.lifecycle, e.start_time, e.end_time,
            f.name AS fest_name, c.name AS club_name, t.name AS type_name,
            (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'pending')   AS pending_count,
            (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') AS confirmed_count
       FROM v_events e
       LEFT JOIN fests f ON f.id = e.fest_id
       LEFT JOIN clubs c ON c.id = e.club_id
       LEFT JOIN event_types t ON t.id = e.event_type_id
      WHERE ? = 1
         OR e.created_by = ?
         OR EXISTS (SELECT 1 FROM positions p
                     WHERE p.user_id = ? AND p.fest_id = e.fest_id AND p.position_type IN ('fest_head', 'gsec'))
         OR (e.kind = 'normal' AND e.scope IN ('multi_club', 'fest')
             AND EXISTS (SELECT 1 FROM positions p
                          WHERE p.user_id = ? AND p.fest_id = e.fest_id AND p.position_type = 'fest_event_creator'))
         OR (e.kind = 'normal' AND e.scope = 'single_club'
             AND EXISTS (SELECT 1 FROM positions p
                          WHERE p.user_id = ? AND p.club_id = e.club_id AND p.position_type = 'club_coordinator'))
         OR (e.kind = 'normal'
             AND EXISTS (SELECT 1 FROM delegations d
                           JOIN delegation_permissions dp ON dp.delegation_id = d.id
                          WHERE d.event_id = e.id AND d.user_id = ? AND d.revoked_at IS NULL
                            AND NOW() <= e.end_time + INTERVAL ? DAY))
      ORDER BY e.start_time DESC`,
    [isAdmin, id, id, id, id, id, DELEGATION_EXPIRY_DAYS]
  );

  res.json(rows);
}

// POST /events — create a draft event
async function createEvent(req, res) {
  const row = buildEventRow(req.body);

  // 1. Required links for the chosen scope (single-club: the fest comes FROM the club)
  if (!row.scope) return badRequest(res, 'Choose who the event belongs to');
  if (row.scope === EVENT_SCOPES.SINGLE_CLUB) {
    if (!row.club_id) return badRequest(res, 'Choose a club');
    const [clubs] = await pool.query('SELECT fest_id FROM clubs WHERE id = ? AND is_active = 1', [row.club_id]);
    if (!clubs[0]) return badRequest(res, 'Choose an active club');
    row.fest_id = clubs[0].fest_id;
  } else if (row.scope !== EVENT_SCOPES.FACULTY && !row.fest_id) {
    return badRequest(res, 'Choose a fest');
  }

  // 2. Permission to create this kind of event here
  if (!(await canCreate(req.user, row))) {
    return res.status(403).json({ message: 'You cannot create this kind of event here' });
  }

  // 3. Event rules
  const participatingClubIds =
    row.scope === EVENT_SCOPES.MULTI_CLUB ? unique(req.body.participating_club_ids || []) : [];
  const problem = await checkEventRules(row, { participatingClubIds });
  if (problem) return badRequest(res, problem);

  const eligibility = row.kind === EVENT_KINDS.NORMAL ? normalizeEligibility(req.body.eligibility) : undefined;

  // 4. Save everything in one transaction
  const conn = await pool.getConnection();
  let eventId;
  try {
    await conn.beginTransaction();

    const [result] = await conn.query('INSERT INTO events SET ?', [
      { ...row, status: EVENT_STATUS.DRAFT, created_by: req.user.id },
    ]);
    eventId = result.insertId;

    await saveEventLinks(conn, eventId, row.fest_id, { participatingClubIds, eligibility });

    if (needsSessions(row)) {
      const sessions = buildDefaultSessions(row.start_time, row.end_time);
      await conn.query('INSERT INTO event_sessions (event_id, title, start_time, end_time) VALUES ?', [
        sessions.map((s) => [eventId, s.title, s.start_time, s.end_time]),
      ]);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  res.status(201).json({ message: 'Draft created', id: eventId });
}

module.exports = { getFormOptions, listMyEvents, createEvent };