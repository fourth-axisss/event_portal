const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Please log in' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
  }

  const [rows] = await pool.query(
    'SELECT id, name, email, role, program, year, department_id, is_active FROM users WHERE id = ?',
    [payload.id]
  );
  const user = rows[0];

  if (!user || user.is_active !== 1) {
    return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    program: user.program,
    year: user.year,
    department_id: user.department_id,
  };
  next();
}

module.exports = authenticate;