const pool = require('../db/pool');
const { ROLES, DELEGATION_EXPIRY_DAYS } = require('../config/constants');

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

  const canOrganize =
    user.role === ROLES.FACULTY || positions.length > 0 || delegations.length > 0;

  return { positions, delegations, can_organize: canOrganize };
}

module.exports = { getCapabilities };