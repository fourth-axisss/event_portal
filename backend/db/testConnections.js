require('dotenv').config({ quiet: true });
const pool = require('./pool');

async function main() {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS user_count FROM users');
    console.log('Connected! Users in database:', rows[0].user_count);

    const [events] = await pool.query(
      'SELECT id, title, start_time, fee FROM events WHERE id <= ? ORDER BY id',
      [3]
    );
    console.log(events);
  } catch (err) {
    console.error('Connection failed:', err.code, '-', err.message);
  } finally {
    await pool.end();
  }
}

main();