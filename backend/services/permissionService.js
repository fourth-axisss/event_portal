const pool = require('../db/pool');
const {
  ROLES,
  POSITION_TYPES,
  EVENT_KINDS,
  EVENT_SCOPES,
  EVENT_STATUS,
  ALL_EVENT_PERMISSIONS,
  DELEGABLE_PERMISSIONS,
  DELEGATION_EXPIRY_DAYS,
} = require('../config/constants');

const { FEST_HEAD, GSEC, FEST_EVENT_CREATOR, CLUB_COORDINATOR } = POSITION_TYPES;

// ---------- menus (/auth/me) ----------

async function getCapabilities(user) {
  const [positions] = await pool.query(
    `SELECT p.id, p.position_type,
            COALESCE(p.fest_id, c.fest_id) AS fest_id, f.name AS fest_name,
            p.club_id, c.name AS club_name
       FROM positions p
       LEFT JOIN clubs c ON c.id = p.club_id
       LEFT JOIN fests f ON f.id = COALESCE(p.fest_id, c.fest_id)
      WHERE p.user_id = ?
      ORDER BY f.name, p.position_type`,
    [user.id]
  );

  const [delegationRows] = await pool.query(
    `SELECT d.event_id, e.title,
            GROUP_CONCAT(dp.permission ORDER BY dp.permission) AS permissions
       FROM delegations d
       JOIN events e ON e.id = d.event_id
       LEFT JOIN delegation_permissions dp ON dp.delegation_id = d.id
      WHERE d.user_id = ?
        AND d.revoked_at IS NULL
        AND NOW() <= e.end_time + INTERVAL ? DAY
      GROUP BY d.id, d.event_id, e.title`,
    [user.id, DELEGATION_EXPIRY_DAYS]
  );

  const delegations = delegationRows.map((d) => ({
    event_id: d.event_id,
    title: d.title,
    permissions: d.permissions ? d.permissions.split(',') : [],
  }));

  const canOrganize = user.role === ROLES.FACULTY || positions.length > 0 || delegations.length > 0;

  return { positions, delegations, can_organize: canOrganize };
}

// Admin, or the Fest Head / GSec of this fest (used for Fest Event Creator routes)
async function isFestLeader(user, festId) {
  if (user.role === ROLES.ADMIN) return true;
  const [rows] = await pool.query(
    `SELECT 1 FROM positions
      WHERE user_id = ? AND fest_id = ? AND position_type IN (?)
      LIMIT 1`,
    [user.id, festId, [FEST_HEAD, GSEC]]
  );
  return rows.length > 0;
}

// ---------- positions ----------

// Every position the user holds; club positions get their club's fest_id
async function getUserPositions(userId) {
  const [rows] = await pool.query(
    `SELECT p.position_type, p.club_id, COALESCE(p.fest_id, c.fest_id) AS fest_id
       FROM positions p
       LEFT JOIN clubs c ON c.id = p.club_id
      WHERE p.user_id = ?`,
    [userId]
  );
  return rows;
}

// Does the user hold one of these position types in exactly this fest?
function holdsInFest(positions, festId, types) {
  return positions.some((p) => types.includes(p.position_type) && p.fest_id === festId);
}

// Does the user coordinate exactly this club?
function coordinatesClub(positions, clubId) {
  return positions.some((p) => p.position_type === CLUB_COORDINATOR && p.club_id === clubId);
}

// The position part of the permission chain (no admin/owner/delegation here)
function organizesThroughPosition(positions, event) {
  if (!event.fest_id) return false; // faculty events belong to no fest
  if (holdsInFest(positions, event.fest_id, [FEST_HEAD, GSEC])) return true;
  if (event.kind === EVENT_KINDS.UMBRELLA) return false; // umbrellas: Fest Head / GSec only

  const festLevel = event.scope === EVENT_SCOPES.MULTI_CLUB || event.scope === EVENT_SCOPES.FEST;
  if (festLevel && holdsInFest(positions, event.fest_id, [FEST_EVENT_CREATOR])) return true;
  if (event.scope === EVENT_SCOPES.SINGLE_CLUB && coordinatesClub(positions, event.club_id)) return true;
  return false;
}

// ---------- event permissions ----------

// Delegated permissions on one event (active, not revoked, never 'manage')
async function getDelegatedPermissions(userId, eventId) {
  const [rows] = await pool.query(
    `SELECT dp.permission
       FROM delegations d
       JOIN events e ON e.id = d.event_id
       JOIN delegation_permissions dp ON dp.delegation_id = d.id
      WHERE d.event_id = ? AND d.user_id = ?
        AND d.revoked_at IS NULL
        AND NOW() <= e.end_time + INTERVAL ? DAY`,
    [eventId, userId, DELEGATION_EXPIRY_DAYS]
  );
  return rows.map((r) => r.permission).filter((p) => DELEGABLE_PERMISSIONS.includes(p));
}

// Everything this user may do on this event: all 5, some (delegate), or []
async function getEventPermissions(user, event) {
  if (user.role === ROLES.ADMIN || event.created_by === user.id) return ALL_EVENT_PERMISSIONS;

  const positions = await getUserPositions(user.id);
  if (organizesThroughPosition(positions, event)) return ALL_EVENT_PERMISSIONS;

  if (event.kind === EVENT_KINDS.UMBRELLA) return [];
  return getDelegatedPermissions(user.id, event.id);
}

async function can(user, event, permission) {
  const permissions = await getEventPermissions(user, event);
  return permissions.includes(permission);
}

// Published and cancelled events: anyone logged in. Drafts: only people with some permission.
async function canView(user, event) {
  if (event.status !== EVENT_STATUS.DRAFT) return true;
  const permissions = await getEventPermissions(user, event);
  return permissions.length > 0;
}

// May this user create an event with this kind / scope / fest / club? (no row exists yet)
async function canCreate(user, row) {
  if (user.role === ROLES.ADMIN) return true;
  if (row.scope === EVENT_SCOPES.FACULTY) return user.role === ROLES.FACULTY;

  const positions = await getUserPositions(user.id);
  const leadsFest = holdsInFest(positions, row.fest_id, [FEST_HEAD, GSEC]);

  if (row.kind === EVENT_KINDS.UMBRELLA) return leadsFest;
  if (row.scope === EVENT_SCOPES.SINGLE_CLUB) return leadsFest || coordinatesClub(positions, row.club_id);
  return leadsFest || holdsInFest(positions, row.fest_id, [FEST_EVENT_CREATOR]); // multi_club, fest
}

module.exports = {
  getCapabilities,
  isFestLeader,
  getUserPositions,
  holdsInFest,
  coordinatesClub,
  getEventPermissions,
  can,
  canView,
  canCreate,
};