const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const { ROLES, BCRYPT_ROUNDS } = require('../config/constants');
const { pick } = require('../services/sqlHelpers');

// GET /admin/users?role=&q=&is_active=
async function listUsers(req, res) {
  const conditions = [];
  const params = [];

  if (req.query.role) {
    conditions.push('u.role = ?');
    params.push(req.query.role);
  }
  if (req.query.is_active) {
    conditions.push('u.is_active = ?');
    params.push(Number(req.query.is_active));
  }
  if (req.query.q && req.query.q.trim()) {
    const like = `%${req.query.q.trim()}%`;
    conditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.roll_no LIKE ?)');
    params.push(like, like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT u.id, u.role, u.name, u.email, u.roll_no, u.program, u.year, u.phone,
            u.department_id, d.code AS department_code, u.is_active, u.created_at
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       ${where}
      ORDER BY u.role, u.name`,
    params
  );
  res.json(rows);
}

// POST /admin/users
async function createUser(req, res) {
  const b = req.body;
  const isStudent = b.role === ROLES.STUDENT;
  const passwordHash = await bcrypt.hash(b.password, BCRYPT_ROUNDS);

  const row = {
    role: b.role,
    name: b.name,
    email: b.email,
    password_hash: passwordHash,
    phone: b.phone || null,
    department_id: b.department_id || null,
    roll_no: isStudent ? b.roll_no : null,
    program: isStudent ? b.program : null,
    year: isStudent ? b.year : null,
  };

  const [result] = await pool.query('INSERT INTO users SET ?', [row]);
  res.status(201).json({ message: 'User created', id: result.insertId });
}

// PATCH /admin/users/:id
async function updateUser(req, res) {
  const id = req.params.id;

  if (id === req.user.id && req.body.is_active === false) {
    return res.status(400).json({ message: 'You cannot deactivate your own account' });
  }

  const [found] = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
  if (!found[0]) {
    return res.status(404).json({ message: 'User not found' });
  }

  const allowed = ['name', 'email', 'phone', 'department_id', 'is_active'];
  if (found[0].role === ROLES.STUDENT) {
    allowed.push('roll_no', 'program', 'year');
  }

  const row = pick(req.body, allowed);
  if (Object.keys(row).length === 0) {
    return res.status(400).json({ message: 'Nothing to update' });
  }

  await pool.query('UPDATE users SET ? WHERE id = ?', [row, id]);
  res.json({ message: 'Saved' });
}

// POST /admin/users/:id/reset-password
async function resetPassword(req, res) {
  const passwordHash = await bcrypt.hash(req.body.new_password, BCRYPT_ROUNDS);
  const [result] = await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [
    passwordHash,
    req.params.id,
  ]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ message: 'Password reset' });
}

module.exports = { listUsers, createUser, updateUser, resetPassword };