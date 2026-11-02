const pool = require('../db/pool');
const { notify } = require('../services/notificationService');
const { EVENT_STATUS, CLASH_STATUSES } = require('../config/constants');

const LIVE_STATUSES = CLASH_STATUSES; // pending, approved, confirmed

// GET /events/:id/announcements   (anyone who can see the event)
async function list(req, res) {
  const [rows] = await pool.query(
    `SELECT a.id, a.title, a.body, a.created_at, u.name AS posted_by_name
       FROM announcements a
       JOIN users u ON u.id = a.posted_by
      WHERE a.event_id = ?
      ORDER BY a.created_at DESC, a.id DESC`,
    [req.event.id]
  );
  res.json(rows);
}

// POST /events/:id/announcements   { title, body }   (requires 'announcements_files')
async function create(req, res) {
  const event = req.event;
  if (event.status === EVENT_STATUS.DRAFT) return res.status(409).json({ message: 'Publish the event first. Nobody can see a draft.' });
  if (event.status === EVENT_STATUS.CANCELLED) return res.status(409).json({ message: 'This event was cancelled' });

  const { title, body } = req.body;
  await pool.query('INSERT INTO announcements (event_id, posted_by, title, body) VALUES (?, ?, ?, ?)', [
    event.id,
    req.user.id,
    title,
    body,
  ]);

  // Everyone registered on this event, or on events inside it (umbrella)
  const [people] = await pool.query(
    `SELECT DISTINCT r.user_id
       FROM registrations r
       JOIN events e ON e.id = r.event_id
      WHERE (e.id = ? OR e.parent_event_id = ?) AND r.status IN (?)`,
    [event.id, event.id, LIVE_STATUSES]
  );
  const userIds = people.map((p) => p.user_id);

  await notify(userIds, `${event.title}: ${title}`, `/events/${event.id}`, {
    emailBody: `${event.title}\n${title}\n\n${body}`,
  });

  res.status(201).json({
    message: userIds.length
      ? `Posted. ${userIds.length} registered participant(s) were notified.`
      : 'Posted. Nobody is registered yet, so it is only shown on the event page.',
  });
}

// DELETE /events/:id/announcements/:announcementId
async function remove(req, res) {
  const [result] = await pool.query('DELETE FROM announcements WHERE id = ? AND event_id = ?', [
    req.params.announcementId,
    req.event.id,
  ]);
  if (result.affectedRows === 0) return res.status(404).json({ message: 'Announcement not found' });
  res.json({ message: 'Announcement deleted' });
}

module.exports = { list, create, remove };






