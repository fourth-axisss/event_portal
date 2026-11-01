const pool = require('../db/pool');
const { notify } = require('../services/notificationService');
const {
  ROLES,
  POSITION_TYPES,
  EVENT_KINDS,
  EVENT_SCOPES,
  EVENT_STATUS,
  EVENT_LIFECYCLE,
  SEAT_TAKING_STATUSES,
  CLASH_STATUSES,
  DELEGATION_EXPIRY_DAYS,
} = require('../config/constants');
const { getUserPositions, holdsInFest, coordinatesClub, canCreate } = require('../services/permissionService');
const {
  buildEventRow,
  normalizeEvent,
  checkEventRules,
  needsSessions,
  buildDefaultSessions,
  unique,
  normalizeEligibility,
  saveEventLinks,
} = require('../services/eventService');
const { pick } = require('../services/sqlHelpers');

const { FEST_HEAD, GSEC, FEST_EVENT_CREATOR } = POSITION_TYPES;
const ACTIVE_STATUSES = CLASH_STATUSES; // pending, approved, confirmed = "registered" in any live sense

// Columns an organizer may change after creation (kind, scope, fest_id, club_id are fixed)
const EDITABLE_COLUMNS = [
  'event_type_id',
  'parent_event_id',
  'title',
  'description',
  'venue_id',
  'start_time',
  'end_time',
  'registration_required',
  'registration_deadline',
  'capacity',
  'fee',
  'auto_approve',
  'is_team_event',
  'team_min',
  'team_max',
  'certificate_criteria',
  'min_attendance_percent',
];
const EVENT_COLUMNS = ['kind', 'scope', 'fest_id', 'club_id', ...EDITABLE_COLUMNS];

function badRequest(res, message) {
  return res.status(400).json({ message });
}

function conflict(res, message) {
  return res.status(409).json({ message });
}

async function countRegistrations(eventId, statuses) {
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM registrations WHERE event_id = ? AND status IN (?)',
    [eventId, statuses]
  );
  return total;
}

// Insert the default sessions for an event row
async function insertDefaultSessions(conn, eventId, row) {
  const sessions = buildDefaultSessions(row.start_time, row.end_time);
  await conn.query('INSERT INTO event_sessions (event_id, title, start_time, end_time) VALUES ?', [
    sessions.map((s) => [eventId, s.title, s.start_time, s.end_time]),
  ]);
}

// ---------- 4A: form options, my events, create ----------

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

  if (!row.scope) return badRequest(res, 'Choose who the event belongs to');
  if (row.scope === EVENT_SCOPES.SINGLE_CLUB) {
    if (!row.club_id) return badRequest(res, 'Choose a club');
    const [clubs] = await pool.query('SELECT fest_id FROM clubs WHERE id = ? AND is_active = 1', [row.club_id]);
    if (!clubs[0]) return badRequest(res, 'Choose an active club');
    row.fest_id = clubs[0].fest_id;
  } else if (row.scope !== EVENT_SCOPES.FACULTY && !row.fest_id) {
    return badRequest(res, 'Choose a fest');
  }

  if (!(await canCreate(req.user, row))) {
    return res.status(403).json({ message: 'You cannot create this kind of event here' });
  }

  const participatingClubIds =
    row.scope === EVENT_SCOPES.MULTI_CLUB ? unique(req.body.participating_club_ids || []) : [];
  const problem = await checkEventRules(row, { participatingClubIds });
  if (problem) return badRequest(res, problem);

  const eligibility = row.kind === EVENT_KINDS.NORMAL ? normalizeEligibility(req.body.eligibility) : undefined;

  const conn = await pool.getConnection();
  let eventId;
  try {
    await conn.beginTransaction();
    const [result] = await conn.query('INSERT INTO events SET ?', [
      { ...row, status: EVENT_STATUS.DRAFT, created_by: req.user.id },
    ]);
    eventId = result.insertId;
    await saveEventLinks(conn, eventId, row.fest_id, { participatingClubIds, eligibility });
    if (needsSessions(row)) await insertDefaultSessions(conn, eventId, row);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  res.status(201).json({ message: 'Draft created', id: eventId });
}

// ---------- 4B: edit and lifecycle ----------

// PATCH /events/:id — merge the changes, re-check every rule, save
async function updateEvent(req, res) {
  const current = req.event;
  const id = current.id;

  if (current.lifecycle === EVENT_LIFECYCLE.COMPLETED || current.status === EVENT_STATUS.CANCELLED) {
    return conflict(res, 'Completed or cancelled events can no longer be edited');
  }

  const changes = pick(req.body, EDITABLE_COLUMNS);
  const linksSent = req.body.participating_club_ids !== undefined || req.body.eligibility !== undefined;
  if (Object.keys(changes).length === 0 && !linksSent) return badRequest(res, 'Nothing to update');

  // 1. Merge and normalize exactly like create
  const merged = normalizeEvent({ ...pick(current, EVENT_COLUMNS), ...changes });

  // 2. Rules that only matter once people have registered
  if (merged.capacity !== null && merged.capacity !== current.capacity) {
    const seats = await countRegistrations(id, SEAT_TAKING_STATUSES);
    if (merged.capacity < seats) return conflict(res, `${seats} seats are already taken; capacity cannot be lower`);
  }
  if (Number(merged.fee) !== Number(current.fee) && (await countRegistrations(id, SEAT_TAKING_STATUSES)) > 0) {
    return conflict(res, 'The fee cannot change after registrations have been approved');
  }
  if (current.registration_required && !merged.registration_required && (await countRegistrations(id, ACTIVE_STATUSES)) > 0) {
    return conflict(res, 'People have registered, so registration cannot be switched off');
  }
  if (current.kind === EVENT_KINDS.UMBRELLA) {
    const [[span]] = await pool.query(
      'SELECT MIN(start_time) AS first_start, MAX(end_time) AS last_end FROM events WHERE parent_event_id = ? AND status <> ?',
      [id, EVENT_STATUS.CANCELLED]
    );
    if (span.first_start && (merged.start_time > span.first_start || merged.end_time < span.last_end)) {
      return badRequest(res, `Its events run from ${span.first_start} to ${span.last_end}; the dates must cover them`);
    }
  }

  // 3. The same rules as create (type activeness only checked if the type was changed)
  let participatingClubIds = [];
  if (merged.scope === EVENT_SCOPES.MULTI_CLUB) {
    if (req.body.participating_club_ids !== undefined) {
      participatingClubIds = unique(req.body.participating_club_ids);
    } else {
      const [rows] = await pool.query('SELECT club_id FROM event_clubs WHERE event_id = ?', [id]);
      participatingClubIds = rows.map((r) => r.club_id);
    }
  }
  const typeChanged = changes.event_type_id !== undefined && changes.event_type_id !== current.event_type_id;
  const problem = await checkEventRules(merged, { participatingClubIds, checkTypeActive: typeChanged });
  if (problem) return badRequest(res, problem);

  // 4. Rebuild sessions if the dates (or the need for sessions) changed and nobody is marked present yet
  const datesChanged = merged.start_time !== current.start_time || merged.end_time !== current.end_time;
  const needChanged = needsSessions(merged) !== needsSessions(current);
  let rebuildSessions = false;
  let note = null;
  if (datesChanged || needChanged) {
    const [marked] = await pool.query('SELECT 1 FROM session_attendance WHERE event_id = ? LIMIT 1', [id]);
    if (marked.length > 0) {
      note = 'Attendance is already marked, so sessions were not changed. Adjust them by hand if needed.';
    } else {
      rebuildSessions = true;
    }
  }

  // 5. Save in one transaction
  const links = {
    participatingClubIds:
      merged.scope === EVENT_SCOPES.MULTI_CLUB && req.body.participating_club_ids !== undefined ? participatingClubIds : undefined,
    eligibility: merged.kind === EVENT_KINDS.NORMAL ? normalizeEligibility(req.body.eligibility) : undefined,
  };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE events SET ? WHERE id = ?', [pick(merged, EDITABLE_COLUMNS), id]);
    await saveEventLinks(conn, id, merged.fest_id, links);
    if (rebuildSessions) {
      await conn.query('DELETE FROM event_sessions WHERE event_id = ?', [id]);
      if (needsSessions(merged)) await insertDefaultSessions(conn, id, merged);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  res.json({ message: 'Saved', sessions_rebuilt: rebuildSessions, note });
}

// POST /events/:id/publish
async function publishEvent(req, res) {
  const event = req.event;
  if (event.status !== EVENT_STATUS.DRAFT) return conflict(res, 'Only drafts can be published');

  if (event.parent_event_id) {
    const [[parent]] = await pool.query('SELECT title, status FROM events WHERE id = ?', [event.parent_event_id]);
    if (parent.status !== EVENT_STATUS.PUBLISHED) return conflict(res, `Publish ${parent.title} first`);
  }

  await pool.query('UPDATE events SET status = ? WHERE id = ?', [EVENT_STATUS.PUBLISHED, event.id]);
  res.json({ message: 'Published' });
}

// POST /events/:id/unpublish — back to draft, only while nobody depends on it
async function unpublishEvent(req, res) {
  const event = req.event;
  if (event.status !== EVENT_STATUS.PUBLISHED) return conflict(res, 'Only published events can go back to draft');

  if ((await countRegistrations(event.id, ACTIVE_STATUSES)) > 0) {
    return conflict(res, 'People have registered. Cancel the event instead.');
  }
  if (event.kind === EVENT_KINDS.UMBRELLA) {
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM events WHERE parent_event_id = ? AND status = ?',
      [event.id, EVENT_STATUS.PUBLISHED]
    );
    if (total > 0) return conflict(res, `${total} of its events are published. Unpublish them first.`);
  }

  await pool.query('UPDATE events SET status = ? WHERE id = ?', [EVENT_STATUS.DRAFT, event.id]);
  res.json({ message: 'Moved back to draft' });
}

// POST /events/:id/cancel  { reason } — an umbrella takes its events with it
async function cancelEvent(req, res) {
  const event = req.event;
  if (event.status !== EVENT_STATUS.PUBLISHED) {
    return conflict(res, 'Only published events can be cancelled. Delete a draft instead.');
  }
  if (event.lifecycle === EVENT_LIFECYCLE.COMPLETED) return conflict(res, 'This event has already finished');

  const reason = req.body.reason;
  const conn = await pool.getConnection();
  let childrenCancelled = 0;
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE events SET status = ?, cancel_reason = ? WHERE id = ?', [
      EVENT_STATUS.CANCELLED,
      reason,
      event.id,
    ]);
    if (event.kind === EVENT_KINDS.UMBRELLA) {
      const [result] = await conn.query(
        'UPDATE events SET status = ?, cancel_reason = ? WHERE parent_event_id = ? AND status <> ?',
        [EVENT_STATUS.CANCELLED, `${event.title} was cancelled: ${reason}`, event.id, EVENT_STATUS.CANCELLED]
      );
      childrenCancelled = result.affectedRows;
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Group 6: notify everyone registered (after commit)
    // Tell everyone registered (on this event, or on events inside a cancelled umbrella)
  const [affected] = await pool.query(
    `SELECT r.user_id, e.id AS event_id, e.title
       FROM registrations r
       JOIN events e ON e.id = r.event_id
      WHERE (e.id = ? OR e.parent_event_id = ?) AND r.status IN (?)`,
    [event.id, event.id, ACTIVE_STATUSES]
  );
  for (const row of affected) {
    await notify([row.user_id], `${row.title} was cancelled: ${reason}`, `/events/${row.event_id}`);
  }

  res.json({ message: 'Event cancelled', children_cancelled: childrenCancelled, notified: affected.length });
}

// DELETE /events/:id — drafts only
async function deleteEvent(req, res) {
  const event = req.event;
  if (event.status !== EVENT_STATUS.DRAFT) {
    return conflict(res, 'Only drafts can be deleted. Cancel a published event instead.');
  }
  if (event.kind === EVENT_KINDS.UMBRELLA) {
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM events WHERE parent_event_id = ?', [event.id]);
    if (total > 0) return conflict(res, `It still has ${total} event(s). Delete or move them first.`);
  }

  await pool.query('DELETE FROM events WHERE id = ?', [event.id]);
  res.json({ message: 'Draft deleted' });
}

module.exports = {
  getFormOptions,
  listMyEvents,
  createEvent,
  updateEvent,
  publishEvent,
  unpublishEvent,
  cancelEvent,
  deleteEvent,
};