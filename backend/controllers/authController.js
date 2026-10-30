const { getCapabilities } = require('../services/permissionService');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

async function login(req, res) {
  const { email, password } = req.body;

  const [rows] = await pool.query(
    'SELECT id, name, email, role, password_hash, is_active FROM users WHERE email = ?',
    [email]
  );
  const user = rows[0];

  const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !passwordOk || user.is_active !== 1) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

async function getMe(req, res) {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.roll_no, u.program, u.year, u.phone,
            u.department_id, d.code AS department_code, d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id = ?`,
    [req.user.id]
  );

  const capabilities = await getCapabilities(req.user);

  res.json({ user: rows[0], capabilities });
}

module.exports = { login, getMe };