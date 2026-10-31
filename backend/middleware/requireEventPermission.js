const pool = require('../db/pool');
const { getEventPermissions } = require('../services/permissionService');
const { EVENT_STATUS } = require('../config/constants');

// Load the event in :id and the user's permissions on it (null after replying with 400/404)
async function loadEventWithPermissions(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ message: 'Invalid event id' });
    return null;
  }

  const [rows] = await pool.query('SELECT * FROM v_events WHERE id = ?', [id]);
  const event = rows[0];
  if (!event) {
    res.status(404).json({ message: 'Event not found' });
    return null;
  }

  const permissions = await getEventPermissions(req.user, event);
  if (event.status === EVENT_STATUS.DRAFT && permissions.length === 0) {
    res.status(404).json({ message: 'Event not found' }); // drafts stay invisible to outsiders
    return null;
  }

  req.event = event;
  req.eventPermissions = permissions;
  return event;
}

// Guard maker: requireEventPermission('manage'), requireEventPermission('attendance'), ...
function requireEventPermission(permission) {
  return async (req, res, next) => {
    const event = await loadEventWithPermissions(req, res);
    if (!event) return;
    if (!req.eventPermissions.includes(permission)) {
      return res.status(403).json({ message: 'You do not have permission to do this for this event' });
    }
    next();
  };
}

// Anyone may see published/cancelled events; drafts only people with some permission
async function requireEventView(req, res, next) {
  const event = await loadEventWithPermissions(req, res);
  if (!event) return;
  next();
}

module.exports = { requireEventPermission, requireEventView };