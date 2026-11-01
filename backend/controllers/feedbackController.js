const pool = require('../db/pool');
const { EVENT_LIFECYCLE, REGISTRATION_STATUS } = require('../config/constants');

// POST /events/:id/feedback   { rating, comment? }
async function submit(req, res) {
  const event = req.event;
  if (event.lifecycle !== EVENT_LIFECYCLE.COMPLETED) {
    return res.status(409).json({ message: 'Feedback opens after the event ends' });
  }

  const [[registration]] = await pool.query('SELECT status FROM registrations WHERE event_id = ? AND user_id = ?', [
    event.id,
    req.user.id,
  ]);
  if (!registration || registration.status !== REGISTRATION_STATUS.CONFIRMED) {
    return res.status(403).json({ message: 'Only confirmed participants can give feedback' });
  }

  try {
    await pool.query('INSERT INTO feedback (event_id, user_id, rating, comment) VALUES (?, ?, ?, ?)', [
      event.id,
      req.user.id,
      req.body.rating,
      req.body.comment || null,
    ]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'You have already given feedback for this event' });
    throw err;
  }
  res.status(201).json({ message: 'Thank you for your feedback' });
}

// GET /events/:id/feedback   (requires 'manage') — anonymous
async function summary(req, res) {
  const [rows] = await pool.query(
    'SELECT rating, comment, created_at FROM feedback WHERE event_id = ? ORDER BY created_at DESC',
    [req.event.id]
  );

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of rows) {
    distribution[r.rating] += 1;
    sum += r.rating;
  }

  res.json({
    count: rows.length,
    average: rows.length ? Math.round((sum / rows.length) * 10) / 10 : null,
    distribution,
    comments: rows.filter((r) => r.comment).map(({ rating, comment, created_at }) => ({ rating, comment, created_at })),
  });
}

module.exports = { submit, summary };