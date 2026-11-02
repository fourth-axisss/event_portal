require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const cors = require('cors');

const pool = require('./db/pool');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// One or more allowed sites, comma-separated, e.g. "http://localhost:5173,https://lnmiit-events.vercel.app"
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
   app.use(
     '/uploads',
     express.static(path.join(__dirname, 'uploads', 'public'), {
       setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
     })
   );

app.get('/api/health', async (req, res) => {
  const [rows] = await pool.query('SELECT NOW() AS db_time');
  res.json({ ok: true, db_time: rows[0].db_time });
});

app.use('/api', require('./routes/authRoutes'));
app.use('/api', require('./routes/masterRoutes'));


app.use('/api', require('./routes/adminRoutes'));

app.use('/api', require('./routes/eventRoutes'));

   app.use('/api', require('./routes/fileRoutes'));

app.use('/api', require('./routes/registrationRoutes'));

app.use('/api', require('./routes/paymentRoutes'));
app.use('/api', require('./routes/notificationRoutes'));


app.use('/api', require('./routes/attendanceRoutes'));
app.use('/api', require('./routes/certificateRoutes'));
app.use('/api', require('./routes/feedbackRoutes'));



app.use('/api', require('./routes/delegationRoutes'));




app.use('/api', require('./routes/announcementRoutes'));



app.use('/api', require('./routes/teamRoutes'));

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