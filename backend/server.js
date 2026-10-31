require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const cors = require('cors');

const pool = require('./db/pool');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads', 'public')));

app.get('/api/health', async (req, res) => {
  const [rows] = await pool.query('SELECT NOW() AS db_time');
  res.json({ ok: true, db_time: rows[0].db_time });
});

app.use('/api', require('./routes/authRoutes'));
app.use('/api', require('./routes/masterRoutes'));


app.use('/api', require('./routes/adminRoutes'));

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, async () => {
  console.log(`API running on http://localhost:${PORT}`);
  try {
    await pool.query('SELECT 1');
    console.log('MySQL connected');
  } catch (err) {
    console.error('MySQL connection failed:', err.code, '-', err.message);
  }
});