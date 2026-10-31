const pool = require('../db/pool');
const { ROLES, POSITION_TYPES } = require('../config/constants');

const HOLDER_LABELS = { fest_head: 'Fest Head', gsec: 'GSec' };

async function findActiveStudent(userId) {
  const [rows] = await pool.query(
    'SELECT id, name FROM users WHERE id = ? AND role = ? AND is_active = 1',
    [userId, ROLES.STUDENT]
  );
  return rows[0] || null;
}

// Insert a position row; returns the new id, or null if this person already holds it
async function insertPosition(values) {
  try {
    const [result] = await pool.query('INSERT INTO positions SET ?', [values]);
    return result.insertId;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return null;
    throw err;
  }
}

// PUT /admin/fests/:festId/holders/:positionType   — handover in one transaction
async function setFestHolder(req, res) {
  const { festId, positionType } = req.params;
  const userId = req.body.user_id;

  const [fests] = await pool.query('SELECT id FROM fests WHERE id = ? AND is_active = 1', [festId]);
  if (!fests[0]) {
    return res.status(404).json({ message: 'Fest not found' });
  }
  const student = await findActiveStudent(userId);
  if (!student) {
    return res.status(400).json({ message: 'Choose an active student' });
  }

  const conn = await pool.getConnection();
  let positionId;
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM positions WHERE fest_id = ? AND position_type = ?', [festId, positionType]);
    const [result] = await conn.query(
      'INSERT INTO positions (user_id, position_type, fest_id, granted_by) VALUES (?, ?, ?, ?)',
      [userId, positionType, festId, req.user.id]
    );
    positionId = result.insertId;
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  res.json({ message: `${HOLDER_LABELS[positionType]} is now ${student.name}`, position_id: positionId });
}

// POST /admin/clubs/:clubId/coordinators
async function addClubCoordinator(req, res) {
  const clubId = req.params.clubId;

  const [clubs] = await pool.query('SELECT id FROM clubs WHERE id = ? AND is_active = 1', [clubId]);
  if (!clubs[0]) {
    return res.status(404).json({ message: 'Club not found' });
  }
  const student = await findActiveStudent(req.body.user_id);
  if (!student) {
    return res.status(400).json({ message: 'Choose an active student' });
  }

  const positionId = await insertPosition({
    user_id: student.id,
    position_type: POSITION_TYPES.CLUB_COORDINATOR,
    club_id: clubId,
    granted_by: req.user.id,
  });
  if (positionId === null) {
    return res.status(409).json({ message: `${student.name} is already a coordinator of this club` });
  }
  res.status(201).json({ message: `${student.name} added as coordinator`, position_id: positionId });
}

// DELETE /admin/positions/:id
async function removePosition(req, res) {
  const [result] = await pool.query('DELETE FROM positions WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'Position not found' });
  }
  res.json({ message: 'Position removed' });
}

// GET /fests/:festId/event-creators   (req.festId set by requireFestLeader)
async function listEventCreators(req, res) {
  const [rows] = await pool.query(
    `SELECT p.id AS position_id, u.id AS user_id, u.name, u.roll_no,
            g.name AS granted_by_name, p.created_at
       FROM positions p
       JOIN users u ON u.id = p.user_id
       JOIN users g ON g.id = p.granted_by
      WHERE p.fest_id = ? AND p.position_type = ?
      ORDER BY u.name`,
    [req.festId, POSITION_TYPES.FEST_EVENT_CREATOR]
  );
  res.json(rows);
}

// POST /fests/:festId/event-creators
async function addEventCreator(req, res) {
  const student = await findActiveStudent(req.body.user_id);
  if (!student) {
    return res.status(400).json({ message: 'Choose an active student' });
  }
  const positionId = await insertPosition({
    user_id: student.id,
    position_type: POSITION_TYPES.FEST_EVENT_CREATOR,
    fest_id: req.festId,
    granted_by: req.user.id,
  });
  if (positionId === null) {
    return res.status(409).json({ message: `${student.name} is already a Fest Event Creator here` });
  }
  res.status(201).json({ message: `${student.name} can now create fest events`, position_id: positionId });
}

// DELETE /fests/:festId/event-creators/:userId
async function removeEventCreator(req, res) {
  const [result] = await pool.query(
    'DELETE FROM positions WHERE fest_id = ? AND user_id = ? AND position_type = ?',
    [req.festId, req.params.userId, POSITION_TYPES.FEST_EVENT_CREATOR]
  );
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'Not a Fest Event Creator of this fest' });
  }
  res.json({ message: 'Removed' });
}

module.exports = {
  setFestHolder,
  addClubCoordinator,
  removePosition,
  listEventCreators,
  addEventCreator,
  removeEventCreator,
};