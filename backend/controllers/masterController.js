const pool = require('../db/pool');
const { ROLES, POSITION_TYPES } = require('../config/constants');

   const { pick } = require('../services/sqlHelpers');

function wantsAll(req) {
  return req.user.role === ROLES.ADMIN && req.query.all === '1';
}

// Builds list / create / update handlers for a simple master-data table.
function makeSimpleCrud({ table, columns, updateColumns = columns, orderBy }) {
  async function list(req, res) {
    const where = wantsAll(req) ? '' : 'WHERE is_active = 1';
    const [rows] = await pool.query(`SELECT ?? FROM ?? ${where} ORDER BY ??`, [
      ['id', ...columns, 'is_active'],
      table,
      orderBy,
    ]);
    res.json(rows);
  }

  async function create(req, res) {
    const row = pick(req.body, columns);
    const [result] = await pool.query('INSERT INTO ?? SET ?', [table, row]);
    res.status(201).json({ message: 'Created', id: result.insertId });
  }

  async function update(req, res) {
    const row = pick(req.body, [...updateColumns, 'is_active']);
    if (Object.keys(row).length === 0) {
      return res.status(400).json({ message: 'Nothing to update' });
    }
    const [result] = await pool.query('UPDATE ?? SET ? WHERE id = ?', [table, row, req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Not found' });
    }
    res.json({ message: 'Saved' });
  }

  return { list, create, update };
}

const departments = makeSimpleCrud({ table: 'departments', columns: ['code', 'name'], orderBy: 'code' });
const venues = makeSimpleCrud({ table: 'venues', columns: ['name', 'capacity'], orderBy: 'name' });
const eventTypes = makeSimpleCrud({
  table: 'event_types',
  columns: ['name', 'organize_rule', 'participate_rule', 'clash_check'],
  orderBy: 'name',
});

const ORG_COLUMNS = ['name', 'description', 'signatory_name', 'signatory_title'];
const fests = makeSimpleCrud({ table: 'fests', columns: ORG_COLUMNS, orderBy: 'name' });
const clubs = makeSimpleCrud({
  table: 'clubs',
  columns: ['fest_id', ...ORG_COLUMNS],
  updateColumns: ORG_COLUMNS, // fest_id can never change
  orderBy: 'name',
});

// GET /fests — each fest with its Fest Head, GSec, clubs and club coordinators
async function listFests(req, res) {
  const where = wantsAll(req) ? '' : 'WHERE is_active = 1';

  const [festRows] = await pool.query(
    `SELECT id, name, description, logo_path, signatory_name, signatory_title, is_active
       FROM fests ${where} ORDER BY name`
  );
  const [clubRows] = await pool.query(
    `SELECT id, fest_id, name, description, logo_path, signatory_name, signatory_title, is_active
       FROM clubs ${where} ORDER BY name`
  );
  const [holderRows] = await pool.query(
    `SELECT p.id AS position_id, p.position_type, p.club_id,
            COALESCE(p.fest_id, c.fest_id) AS fest_id,
            u.id AS user_id, u.name, u.roll_no
       FROM positions p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN clubs c ON c.id = p.club_id
      WHERE p.position_type IN (?)
      ORDER BY u.name`,
    [[POSITION_TYPES.FEST_HEAD, POSITION_TYPES.GSEC, POSITION_TYPES.CLUB_COORDINATOR]]
  );

  const festById = new Map();
  const result = festRows.map((f) => {
    const fest = { ...f, fest_head: null, gsec: null, clubs: [] };
    festById.set(f.id, fest);
    return fest;
  });

  const clubById = new Map();
  for (const c of clubRows) {
    const fest = festById.get(c.fest_id);
    if (!fest) continue; // its fest is inactive and not shown
    const club = { ...c, coordinators: [] };
    fest.clubs.push(club);
    clubById.set(c.id, club);
  }

  for (const h of holderRows) {
    const person = { position_id: h.position_id, user_id: h.user_id, name: h.name, roll_no: h.roll_no };
    if (h.position_type === POSITION_TYPES.CLUB_COORDINATOR) {
      clubById.get(h.club_id)?.coordinators.push(person);
    } else {
      const fest = festById.get(h.fest_id);
      if (fest) fest[h.position_type] = person; // sets fest.fest_head or fest.gsec
    }
  }

  res.json(result);
}

// GET /users/lookup?roll_no=... — find one active student, minimal fields
async function lookupUser(req, res) {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.roll_no, u.program, u.year, d.code AS department_code
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.roll_no = ? AND u.role = ? AND u.is_active = 1`,
    [req.query.roll_no, ROLES.STUDENT]
  );
  if (!rows[0]) {
    return res.status(404).json({ message: 'No active student with that roll number' });
  }
  res.json(rows[0]);
}

module.exports = { departments, venues, eventTypes, fests, clubs, listFests, lookupUser };