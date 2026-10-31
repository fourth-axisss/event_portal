const { isFestLeader } = require('../services/permissionService');

async function requireFestLeader(req, res, next) {
  const festId = Number(req.params.festId);
  if (!Number.isInteger(festId) || festId < 1) {
    return res.status(400).json({ message: 'Invalid fest id' });
  }
  if (!(await isFestLeader(req.user, festId))) {
    return res.status(403).json({ message: 'Only this fest\'s Fest Head, GSec or an admin can do this' });
  }
  req.festId = festId;
  next();
}

module.exports = requireFestLeader;