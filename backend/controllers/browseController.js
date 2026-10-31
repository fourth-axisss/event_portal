const pool = require('../db/pool');
const { ROLES, EVENT_KINDS, EVENT_STATUS, EVENT_PERMISSIONS } = require('../config/constants');
const { getUserFlags } = require('../services/registrationService');

// One SELECT for both the list and the detail page
const BASE_SELECT = `
  SELECT e.id, e.kind, e.scope, e.status, e.lifecycle, e.title, e.description,
         e.start_time, e.end_time, e.registration_required, e.registration_deadline,
         e.capacity, e.fee, e.auto_approve, e.is_team_event, e.team_min, e.team_max,
         e.certificate_criteria, e.min_attendance_percent, e.poster_path, e.cancel_reason,
         e.created_by, u.name AS organizer_name,
         e.event_type_id, t.name AS type_name, t.participate_rule, t.clash_check,
         e.fest_id, f.name AS fest_name, e.club_id, c.name AS club_name,
         e.venue_id, v.name AS venue_name,
         e.parent_event_id, p.title AS parent_title,
         p.start_time AS parent_start_time, p.end_time AS parent_end_time,
         (SELECT COUNT(*) FROM events ch
           WHERE ch.parent_event_id = e.id AND ch.status = 'published') AS child_count
    FROM v_events e
    JOIN users u ON u.id = e.created_by
    LEFT JOIN event_types t ON t.id = e.event_type_id
    LEFT JOIN fests f ON f.id = e.fest_id
    LEFT JOIN clubs c ON c.id = e.club_id
    LEFT JOIN venues v ON v.id = e.venue_id
    LEFT JOIN events p ON p.id = e.parent_event_id`;

// Browse filter → the lifecycle values it covers
const LIFECYCLE_FILTERS = {
  registration_open: ['registration_open'],
  upcoming: ['registration_open', 'registration_closed', 'upcoming'],
  ongoing: ['ongoing'],
  completed: ['completed'],
};

// GET /events?q=&fest_id=&event_type_id=&umbrella_id=&lifecycle=
async function listEvents(req, res) {
  const user = req.user;
  const q = req.query;

  const participateRules = user.role === ROLES.ADMIN ? ['student', 'faculty', 'both'] : ['both', user.role];
  const conditions = ['e.status = ?', "(e.kind = 'umbrella' OR t.participate_rule IN (?))"];
  const params = [EVENT_STATUS.PUBLISHED, participateRules];

  if (q.q && q.q.trim()) {
    conditions.push('e.title LIKE ?');
    params.push(`%${q.q.trim()}%`);
  }
  if (q.fest_id) {
    conditions.push('e.fest_id = ?');
    params.push(Number(q.fest_id));
  }
  if (q.event_type_id) {
    conditions.push('e.event_type_id = ?');
    params.push(Number(q.event_type_id));
  }
  if (q.umbrella_id) {
    conditions.push('e.parent_event_id = ?');
    params.push(Number(q.umbrella_id));
  }
  if (q.lifecycle) {
    conditions.push('e.lifecycle IN (?)');
    params.push(LIFECYCLE_FILTERS[q.lifecycle]);
  }

  const [rows] = await pool.query(`${BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY e.start_time`, params);
  const flags = await getUserFlags(user, rows);

  res.json(rows.map((row) => ({ ...row, my: flags.get(row.id) })));
}

// GET /events/:id  (requireEventView has already loaded req.event and req.eventPermissions)
async function getEvent(req, res) {
  const id = req.event.id;
  const [[event]] = await pool.query(`${BASE_SELECT} WHERE e.id = ?`, [id]);

  const [sessions] = await pool.query(
    'SELECT id, title, start_time, end_time FROM event_sessions WHERE event_id = ? ORDER BY start_time',
    [id]
  );
  const [files] = await pool.query(
    `SELECT id, title, original_name, mime_type, size_bytes, created_at
       FROM event_files WHERE event_id = ? ORDER BY created_at`,
    [id]
  );
  const [cells] = await pool.query(
    'SELECT program, year FROM event_eligibility WHERE event_id = ? ORDER BY program, year',
    [id]
  );
  const [departments] = await pool.query(
    `SELECT d.id, d.code, d.name
       FROM event_eligible_departments ed
       JOIN departments d ON d.id = ed.department_id
      WHERE ed.event_id = ? ORDER BY d.code`,
    [id]
  );
  const [participatingClubs] = await pool.query(
    `SELECT c.id, c.name FROM event_clubs ec JOIN clubs c ON c.id = ec.club_id
      WHERE ec.event_id = ? ORDER BY c.name`,
    [id]
  );

  let children = [];
  if (event.kind === EVENT_KINDS.UMBRELLA) {
    const [childRows] = await pool.query(`${BASE_SELECT} WHERE e.parent_event_id = ? AND e.status = ? ORDER BY e.start_time`, [
      id,
      EVENT_STATUS.PUBLISHED,
    ]);
    const childFlags = await getUserFlags(req.user, childRows);
    children = childRows.map((row) => ({ ...row, my: childFlags.get(row.id) }));
  }

  const myFlags = (await getUserFlags(req.user, [event])).get(id);
  const [feedbackRows] = await pool.query('SELECT 1 FROM feedback WHERE event_id = ? AND user_id = ?', [id, req.user.id]);

  res.json({
    ...event,
    sessions,
    files,
    eligibility: { cells, departments },
    participating_clubs: participatingClubs,
    children,
    my: {
      ...myFlags,
      feedback_given: feedbackRows.length > 0,
      permissions: req.eventPermissions,
      can_manage: req.eventPermissions.includes(EVENT_PERMISSIONS.MANAGE),
    },
  });
}

module.exports = { listEvents, getEvent };