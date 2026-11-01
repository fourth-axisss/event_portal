const pool = require('../db/pool');
const { unique } = require('../services/eventService');
const { EVENT_STATUS, REGISTRATION_STATUS } = require('../config/constants');

// The integer rule from 03-database-schema.md: attended*100 >= min*total (and there are sessions)
function meetsCriteria(attended, total, minPercent) {
  return total > 0 && attended * 100 >= minPercent * total;
}

// GET /events/:id/attendance   (requires 'attendance')
async function getAttendance(req, res) {
  const event = req.event;

  const [sessions] = await pool.query(
    `SELECT id, title, start_time, end_time, start_time <= NOW() AS started
       FROM event_sessions WHERE event_id = ? ORDER BY start_time`,
    [event.id]
  );
  const [participants] = await pool.query(
    `SELECT r.id AS registration_id, u.id AS user_id, u.name, u.roll_no
       FROM registrations r
       JOIN users u ON u.id = r.user_id
      WHERE r.event_id = ? AND r.status = ?
      ORDER BY u.name`,
    [event.id, REGISTRATION_STATUS.CONFIRMED]
  );
  const [marks] = await pool.query('SELECT session_id, registration_id FROM session_attendance WHERE event_id = ?', [event.id]);

  const sessionsByRegistration = new Map();
  for (const m of marks) {
    if (!sessionsByRegistration.has(m.registration_id)) sessionsByRegistration.set(m.registration_id, []);
    sessionsByRegistration.get(m.registration_id).push(m.session_id);
  }

  const total = sessions.length;
  res.json({
    certificate_criteria: event.certificate_criteria,
    min_attendance_percent: event.min_attendance_percent,
    sessions,
    participants: participants.map((p) => {
      const present = sessionsByRegistration.get(p.registration_id) || [];
      return {
        ...p,
        present_session_ids: present,
        attended: present.length,
        total,
        meets_criteria: meetsCriteria(present.length, total, event.min_attendance_percent),
      };
    }),
  });
}

// PUT /events/:id/sessions/:sessionId/attendance   { present_registration_ids }
async function saveSessionAttendance(req, res) {
  const event = req.event;
  if (event.status === EVENT_STATUS.CANCELLED) {
    return res.status(409).json({ message: 'This event was cancelled' });
  }

  const sessionId = req.params.sessionId;
  const [[session]] = await pool.query(
    'SELECT id, title, start_time <= NOW() AS started FROM event_sessions WHERE id = ? AND event_id = ?',
    [sessionId, event.id]
  );
  if (!session) return res.status(404).json({ message: 'Session not found' });
  if (!session.started) return res.status(409).json({ message: 'Attendance can be marked once the session has started' });

  const ids = unique(req.body.present_registration_ids);
  if (ids.length > 0) {
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM registrations WHERE id IN (?) AND event_id = ? AND status = ?',
      [ids, event.id, REGISTRATION_STATUS.CONFIRMED]
    );
    if (total !== ids.length) {
      return res.status(400).json({ message: 'Only confirmed participants of this event can be marked present' });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (ids.length === 0) {
      await conn.query('DELETE FROM session_attendance WHERE session_id = ?', [sessionId]);
    } else {
      await conn.query('DELETE FROM session_attendance WHERE session_id = ? AND registration_id NOT IN (?)', [sessionId, ids]);
      await conn.query(
        `INSERT IGNORE INTO session_attendance (session_id, event_id, registration_id, method, marked_by)
         VALUES ?`,
        [ids.map((registrationId) => [sessionId, event.id, registrationId, 'manual', req.user.id])]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  res.json({ message: `${session.title}: ${ids.length} present`, present: ids.length });
}

module.exports = { getAttendance, saveSessionAttendance };