const pool = require('../db/pool');

function insideEvent(event, start, end) {
  return start >= event.start_time && end <= event.end_time;
}

// Run a session INSERT/UPDATE; returns false if another session already starts at that time
async function saveSession(sql, params) {
  try {
    await pool.query(sql, params);
    return true;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return false;
    throw err;
  }
}

async function findSession(eventId, sessionId) {
  const [rows] = await pool.query(
    'SELECT id, title, start_time, end_time FROM event_sessions WHERE id = ? AND event_id = ?',
    [sessionId, eventId]
  );
  return rows[0] || null;
}

function checkTimes(res, event, start, end) {
  if (end <= start) {
    res.status(400).json({ message: 'Session end must be after its start' });
    return false;
  }
  if (!insideEvent(event, start, end)) {
    res.status(400).json({ message: `Sessions must be within the event (${event.start_time} to ${event.end_time})` });
    return false;
  }
  return true;
}

// GET /events/:id/sessions
async function listSessions(req, res) {
  const [rows] = await pool.query(
    'SELECT id, title, start_time, end_time FROM event_sessions WHERE event_id = ? ORDER BY start_time',
    [req.event.id]
  );
  res.json(rows);
}

// POST /events/:id/sessions
async function createSession(req, res) {
  const { title, start_time: start, end_time: end } = req.body;
  if (!checkTimes(res, req.event, start, end)) return;

  const saved = await saveSession(
    'INSERT INTO event_sessions (event_id, title, start_time, end_time) VALUES (?, ?, ?, ?)',
    [req.event.id, title, start, end]
  );
  if (!saved) return res.status(409).json({ message: 'Another session already starts at that time' });
  res.status(201).json({ message: 'Session added' });
}

// PATCH /events/:id/sessions/:sessionId
async function updateSession(req, res) {
  const session = await findSession(req.event.id, req.params.sessionId);
  if (!session) return res.status(404).json({ message: 'Session not found' });

  const title = req.body.title ?? session.title;
  const start = req.body.start_time ?? session.start_time;
  const end = req.body.end_time ?? session.end_time;
  if (!checkTimes(res, req.event, start, end)) return;

  const saved = await saveSession(
    'UPDATE event_sessions SET title = ?, start_time = ?, end_time = ? WHERE id = ? AND event_id = ?',
    [title, start, end, session.id, req.event.id]
  );
  if (!saved) return res.status(409).json({ message: 'Another session already starts at that time' });
  res.json({ message: 'Session saved' });
}

// DELETE /events/:id/sessions/:sessionId
async function deleteSession(req, res) {
  const session = await findSession(req.event.id, req.params.sessionId);
  if (!session) return res.status(404).json({ message: 'Session not found' });

  const [marked] = await pool.query('SELECT 1 FROM session_attendance WHERE session_id = ? LIMIT 1', [session.id]);
  if (marked.length > 0) {
    return res.status(409).json({ message: 'Attendance has been marked for this session, so it cannot be removed' });
  }

  await pool.query('DELETE FROM event_sessions WHERE id = ? AND event_id = ?', [session.id, req.event.id]);
  res.json({ message: 'Session removed' });
}

module.exports = { listSessions, createSession, updateSession, deleteSession };