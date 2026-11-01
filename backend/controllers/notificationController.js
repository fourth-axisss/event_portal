const pool = require('../db/pool');

const LIST_LIMIT = 30;

// GET /notifications/unread-count
async function unreadCount(req, res) {
  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
    [req.user.id]
  );
  res.json({ count });
}

// GET /notifications
async function list(req, res) {
  const [rows] = await pool.query(
    `SELECT id, message, link, is_read, created_at
       FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
    [req.user.id, LIST_LIMIT]
  );
  res.json(rows);
}

// POST /notifications/:id/read
async function markRead(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid notification id' });
  await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, req.user.id]);
  res.json({ message: 'Marked as read' });
}

// POST /notifications/read-all
async function markAllRead(req, res) {
  await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
  res.json({ message: 'All marked as read' });
}

module.exports = { unreadCount, list, markRead, markAllRead };