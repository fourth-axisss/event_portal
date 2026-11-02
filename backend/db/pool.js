const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4_0900_ai_ci',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  decimalNumbers: true,
});

// Every new connection uses Indian time, so NOW() is correct even on a UTC cloud database
pool.pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+05:30'");
});

module.exports = pool;