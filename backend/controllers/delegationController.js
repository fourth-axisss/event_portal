/*const pool = require('../db/pool');
const HttpError = require('../utils/HttpError');
const { getEventPermissions } = require('../services/permissionService');
const { notify } = require('../services/notificationService');
const { unique } = require('../services/eventService');
const {
  ROLES,
  EVENT_KINDS,
  EVENT_STATUS,
  EVENT_PERMISSIONS,
  CLASH_STATUSES,
  DELEGATION_EXPIRY_DAYS,
} = require('../config/constants');

const PERMISSION_LABELS = {
  registrations: 'registrations',
  attendance: 'attendance',
  announcements_files: 'announcements & files',
  certificates: 'certificates',
};

function describe(permissions) {
  return permissions.map((p) => PERMISSION_LABELS[p]).join(', ');
}

// GET /events/:id/delegates
async function list(req, res) {
  const [rows] = await pool.query(
    `SELECT d.id AS delegation_id, d.user_id, u.name, u.roll_no,
            g.name AS granted_by_name, d.created_at, d.revoked_at, rv.name AS revoked_by_name,
            e.end_time + INTERVAL ? DAY AS expires_at,
            (d.revoked_at IS NULL AND NOW() <= e.end_time + INTERVAL ? DAY) AS active,
            GROUP_CONCAT(dp.permission ORDER BY dp.permission) AS permissions
       FROM delegations d
       JOIN users u ON u.id = d.user_id
       JOIN users g ON g.id = d.granted_by
       JOIN events e ON e.id = d.event_id
       LEFT JOIN users rv ON rv.id = d.revoked_by
       LEFT JOIN delegation_permissions dp ON dp.delegation_id = d.id
      WHERE d.event_id = ?
      GROUP BY d.id, d.user_id, u.name, u.roll_no, g.name, d.created_at, d.revoked_at, rv.name, e.end_time
      ORDER BY active DESC, u.name`,
    [DELEGATION_EXPIRY_DAYS, DELEGATION_EXPIRY_DAYS, req.event.id]
  );

  res.json(rows.map((r) => ({ ...r, permissions: r.permissions ? r.permissions.split(',') : [] })));
}

// POST /events/:id/delegates   { user_id, permissions }
async function add(req, res) {
  const event = req.event;
  if (event.kind === EVENT_KINDS.UMBRELLA) return res.status(400).json({ message: 'Umbrella events cannot have delegates' });
  if (event.status === EVENT_STATUS.CANCELLED) return res.status(409).json({ message: 'This event was cancelled' });

  const permissions = unique(req.body.permissions);
  const [[user]] = await pool.query(
    'SELECT id, name, role, is_active, program, year, department_id FROM users WHERE id = ?',
    [req.body.user_id]
  );
  if (!user || !user.is_active || user.role !== ROLES.STUDENT) {
    return res.status(400).json({ message: 'Choose an active student' });
  }

  // Already organizing it through ownership or a position?
  const current = await getEventPermissions(user, event);
  if (current.includes(EVENT_PERMISSIONS.MANAGE)) {
    return res.status(409).json({ message: `${user.name} already manages this event` });
  }

  // Conflict of interest: participants cannot also help run it
  const [registered] = await pool.query(
    'SELECT 1 FROM registrations WHERE event_id = ? AND user_id = ? AND status IN (?) LIMIT 1',
    [event.id, user.id, CLASH_STATUSES]
  );
  if (registered.length > 0) {
    return res.status(409).json({ message: `${user.name} is registered for this event, so they cannot help organize it` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[existing]] = await conn.query(
      'SELECT id, revoked_at FROM delegations WHERE event_id = ? AND user_id = ? FOR UPDATE',
      [event.id, user.id]
    );
    if (existing && !existing.revoked_at) {
      throw new HttpError(409, `${user.name} is already a delegate. Change their permissions instead.`);
    }

    let delegationId;
    if (existing) {
      // previously revoked: reuse the row
      await conn.query(
        'UPDATE delegations SET revoked_at = NULL, revoked_by = NULL, granted_by = ?, created_at = NOW() WHERE id = ?',
        [req.user.id, existing.id]
      );
      await conn.query('DELETE FROM delegation_permissions WHERE delegation_id = ?', [existing.id]);
      delegationId = existing.id;
    } else {
      const [result] = await conn.query('INSERT INTO delegations (event_id, user_id, granted_by) VALUES (?, ?, ?)', [
        event.id,
        user.id,
        req.user.id,
      ]);
      delegationId = result.insertId;
    }

    await conn.query('INSERT INTO delegation_permissions (delegation_id, permission) VALUES ?', [
      permissions.map((p) => [delegationId, p]),
    ]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await notify(
    [user.id],
    `You've been asked to help with ${event.title}: ${describe(permissions)}.`,
    `/organize/events/${event.id}`
  );
  res.status(201).json({ message: `${user.name} can now help with ${describe(permissions)}` });
}

// Find an active delegation of THIS event (IDOR rule)
async function findActive(db, eventId, delegationId) {
  const [[row]] = await db.query(
    'SELECT d.id, d.user_id, u.name FROM delegations d JOIN users u ON u.id = d.user_id WHERE d.id = ? AND d.event_id = ? AND d.revoked_at IS NULL',
    [delegationId, eventId]
  );
  return row || null;
}

// PUT /events/:id/delegates/:delegationId/permissions   { permissions }
async function setPermissions(req, res) {
  const delegation = await findActive(pool, req.event.id, req.params.delegationId);
  if (!delegation) return res.status(404).json({ message: 'Delegate not found' });
  const permissions = unique(req.body.permissions);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM delegation_permissions WHERE delegation_id = ?', [delegation.id]);
    await conn.query('INSERT INTO delegation_permissions (delegation_id, permission) VALUES ?', [
      permissions.map((p) => [delegation.id, p]),
    ]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  res.json({ message: `${delegation.name} can now help with ${describe(permissions)}` });
}

// POST /events/:id/delegates/:delegationId/revoke
async function revoke(req, res) {
  const delegation = await findActive(pool, req.event.id, req.params.delegationId);
  if (!delegation) return res.status(404).json({ message: 'Delegate not found' });

  await pool.query('UPDATE delegations SET revoked_at = NOW(), revoked_by = ? WHERE id = ?', [req.user.id, delegation.id]);
  await notify([delegation.user_id], `Your access to ${req.event.title} was removed.`, null, { email: false });
  res.json({ message: `${delegation.name} no longer has access` });
}

module.exports = { list, add, setPermissions, revoke };*/












const pool = require('../db/pool');
const HttpError = require('../utils/HttpError');
const { getEventPermissions } = require('../services/permissionService');
const { notify } = require('../services/notificationService');
const { unique } = require('../services/eventService');
const {
  ROLES,
  EVENT_KINDS,
  EVENT_STATUS,
  EVENT_PERMISSIONS,
  DELEGATION_EXPIRY_DAYS,
} = require('../config/constants');

const PERMISSION_LABELS = {
  registrations: 'registrations',
  attendance: 'attendance',
  announcements_files: 'announcements & files',
  certificates: 'certificates',
};

function describe(permissions) {
  return permissions.map((p) => PERMISSION_LABELS[p]).join(', ');
}

// GET /events/:id/delegates
async function list(req, res) {
  const [rows] = await pool.query(
    `SELECT d.id AS delegation_id, d.user_id, u.name, u.roll_no,
            g.name AS granted_by_name, d.created_at, d.revoked_at, rv.name AS revoked_by_name,
            e.end_time + INTERVAL ? DAY AS expires_at,
            (d.revoked_at IS NULL AND NOW() <= e.end_time + INTERVAL ? DAY) AS active,
            GROUP_CONCAT(dp.permission ORDER BY dp.permission) AS permissions
       FROM delegations d
       JOIN users u ON u.id = d.user_id
       JOIN users g ON g.id = d.granted_by
       JOIN events e ON e.id = d.event_id
       LEFT JOIN users rv ON rv.id = d.revoked_by
       LEFT JOIN delegation_permissions dp ON dp.delegation_id = d.id
      WHERE d.event_id = ?
      GROUP BY d.id, d.user_id, u.name, u.roll_no, g.name, d.created_at, d.revoked_at, rv.name, e.end_time
      ORDER BY active DESC, u.name`,
    [DELEGATION_EXPIRY_DAYS, DELEGATION_EXPIRY_DAYS, req.event.id]
  );

  res.json(rows.map((r) => ({ ...r, permissions: r.permissions ? r.permissions.split(',') : [] })));
}

// POST /events/:id/delegates   { user_id, permissions }
async function add(req, res) {
  const event = req.event;
  if (event.kind === EVENT_KINDS.UMBRELLA) return res.status(400).json({ message: 'Umbrella events cannot have delegates' });
  if (event.status === EVENT_STATUS.CANCELLED) return res.status(409).json({ message: 'This event was cancelled' });

  const permissions = unique(req.body.permissions);
  const [[user]] = await pool.query(
    'SELECT id, name, role, is_active, program, year, department_id FROM users WHERE id = ?',
    [req.body.user_id]
  );
  if (!user || !user.is_active || user.role !== ROLES.STUDENT) {
    return res.status(400).json({ message: 'Choose an active student' });
  }

  // Already organizing it through ownership or a position?
  const current = await getEventPermissions(user, event);
  if (current.includes(EVENT_PERMISSIONS.MANAGE)) {
    return res.status(409).json({ message: `${user.name} already manages this event` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[existing]] = await conn.query(
      'SELECT id, revoked_at FROM delegations WHERE event_id = ? AND user_id = ? FOR UPDATE',
      [event.id, user.id]
    );
    if (existing && !existing.revoked_at) {
      throw new HttpError(409, `${user.name} is already a delegate. Change their permissions instead.`);
    }

    let delegationId;
    if (existing) {
      // previously revoked: reuse the row
      await conn.query(
        'UPDATE delegations SET revoked_at = NULL, revoked_by = NULL, granted_by = ?, created_at = NOW() WHERE id = ?',
        [req.user.id, existing.id]
      );
      await conn.query('DELETE FROM delegation_permissions WHERE delegation_id = ?', [existing.id]);
      delegationId = existing.id;
    } else {
      const [result] = await conn.query('INSERT INTO delegations (event_id, user_id, granted_by) VALUES (?, ?, ?)', [
        event.id,
        user.id,
        req.user.id,
      ]);
      delegationId = result.insertId;
    }

    await conn.query('INSERT INTO delegation_permissions (delegation_id, permission) VALUES ?', [
      permissions.map((p) => [delegationId, p]),
    ]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await notify(
    [user.id],
    `You've been asked to help with ${event.title}: ${describe(permissions)}.`,
    `/organize/events/${event.id}`
  );
  res.status(201).json({ message: `${user.name} can now help with ${describe(permissions)}` });
}

// Find an active delegation of THIS event (IDOR rule)
async function findActive(db, eventId, delegationId) {
  const [[row]] = await db.query(
    'SELECT d.id, d.user_id, u.name FROM delegations d JOIN users u ON u.id = d.user_id WHERE d.id = ? AND d.event_id = ? AND d.revoked_at IS NULL',
    [delegationId, eventId]
  );
  return row || null;
}

// PUT /events/:id/delegates/:delegationId/permissions   { permissions }
async function setPermissions(req, res) {
  const delegation = await findActive(pool, req.event.id, req.params.delegationId);
  if (!delegation) return res.status(404).json({ message: 'Delegate not found' });
  const permissions = unique(req.body.permissions);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM delegation_permissions WHERE delegation_id = ?', [delegation.id]);
    await conn.query('INSERT INTO delegation_permissions (delegation_id, permission) VALUES ?', [
      permissions.map((p) => [delegation.id, p]),
    ]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  res.json({ message: `${delegation.name} can now help with ${describe(permissions)}` });
}

// POST /events/:id/delegates/:delegationId/revoke
async function revoke(req, res) {
  const delegation = await findActive(pool, req.event.id, req.params.delegationId);
  if (!delegation) return res.status(404).json({ message: 'Delegate not found' });

  await pool.query('UPDATE delegations SET revoked_at = NOW(), revoked_by = ? WHERE id = ?', [req.user.id, delegation.id]);
  await notify([delegation.user_id], `Your access to ${req.event.title} was removed.`, null, { email: false });
  res.json({ message: `${delegation.name} no longer has access` });
}

module.exports = { list, add, setPermissions, revoke };