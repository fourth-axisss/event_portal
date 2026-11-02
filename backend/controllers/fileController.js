const crypto = require('crypto');
const path = require('path');
const pool = require('../db/pool');
const { canView } = require('../services/permissionService');
const { PRIVATE_FILES_DIR, publicFilePath, removeFile } = require('../services/fileStorage');

// ---------- poster ----------

// POST /events/:id/poster   (multipart field "poster")
async function setPoster(req, res) {
  const event = req.event;
  const posterPath = `posters/${req.file.filename}`;
  await pool.query('UPDATE events SET poster_path = ? WHERE id = ?', [posterPath, event.id]);
  if (event.poster_path) await removeFile(publicFilePath(event.poster_path));
  res.json({ message: 'Poster saved', poster_path: posterPath });
}

// DELETE /events/:id/poster
async function removePoster(req, res) {
  const event = req.event;
  if (!event.poster_path) return res.status(404).json({ message: 'This event has no poster' });
  await pool.query('UPDATE events SET poster_path = NULL WHERE id = ?', [event.id]);
  await removeFile(publicFilePath(event.poster_path));
  res.json({ message: 'Poster removed' });
}

// ---------- event files ----------

// POST /events/:id/files   (multipart: text field "title", file field "file")
// The file arrives in memory (req.file.buffer) and is stored in event_files.data.
async function uploadEventFile(req, res) {
  const original = req.file.originalname;
  const title = (req.body.title || '').trim() || path.parse(original).name;
  if (title.length > 150) return res.status(400).json({ message: 'Title can be at most 150 characters' });

  const [result] = await pool.query('INSERT INTO event_files SET ?', [
    {
      event_id: req.event.id,
      title,
      stored_name: `${crypto.randomUUID()}${path.extname(original).toLowerCase()}`, // unique id for the file
      original_name: original.slice(0, 255),
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
      data: req.file.buffer,
      uploaded_by: req.user.id,
    },
  ]);
  res.status(201).json({ message: `"${title}" uploaded`, id: result.insertId });
}

// PATCH /events/:id/files/:fileId   { title }
async function renameEventFile(req, res) {
  const [result] = await pool.query('UPDATE event_files SET title = ? WHERE id = ? AND event_id = ?', [
    req.body.title,
    req.params.fileId,
    req.event.id,
  ]);
  if (result.affectedRows === 0) return res.status(404).json({ message: 'File not found' });
  res.json({ message: 'Renamed' });
}

// DELETE /events/:id/files/:fileId
async function deleteEventFile(req, res) {
  const [rows] = await pool.query('SELECT stored_name FROM event_files WHERE id = ? AND event_id = ?', [
    req.params.fileId,
    req.event.id,
  ]);
  if (!rows[0]) return res.status(404).json({ message: 'File not found' });

  await pool.query('DELETE FROM event_files WHERE id = ?', [req.params.fileId]); // the file's bytes go with the row
  await removeFile(path.join(PRIVATE_FILES_DIR, rows[0].stored_name)); // older files kept on disk; none = fine
  res.json({ message: 'File deleted' });
}

// 'Brochure (final).pdf' → a Content-Disposition header that is safe for any file name
function contentDisposition(type, fileName) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const utf8 = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

// GET /files/:fileId/download — only for people who can view the file's event
// Sent "inline" so a PDF or image opens in the browser; ?download=1 asks the browser to save it instead.
async function downloadFile(req, res) {
  const fileId = Number(req.params.fileId);
  if (!Number.isInteger(fileId) || fileId < 1) return res.status(400).json({ message: 'Invalid file id' });

  const [files] = await pool.query(
    'SELECT event_id, stored_name, original_name, mime_type, data FROM event_files WHERE id = ?',
    [fileId]
  );
  const file = files[0];
  if (!file) return res.status(404).json({ message: 'File not found' });

  const [events] = await pool.query('SELECT * FROM v_events WHERE id = ?', [file.event_id]);
  if (!events[0] || !(await canView(req.user, events[0]))) {
    return res.status(404).json({ message: 'File not found' });
  }

  const disposition = req.query.download === '1' ? 'attachment' : 'inline';

  // Files uploaded before files moved into the database are still read from disk
  if (!file.data) {
    return res.download(path.join(PRIVATE_FILES_DIR, file.stored_name), file.original_name, (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'The file is missing on the server' });
    });
  }

  res.set({
    'Content-Type': file.mime_type,
    'Content-Disposition': contentDisposition(disposition, file.original_name),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  res.send(file.data);
}

// ---------- logos (admin) ----------

function makeLogoHandler(table) {
  return async (req, res) => {
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT logo_path FROM ?? WHERE id = ?', [table, id]);
    if (!rows[0]) {
      await removeFile(req.file.path);
      return res.status(404).json({ message: 'Not found' });
    }

    const logoPath = `logos/${req.file.filename}`;
    await pool.query('UPDATE ?? SET logo_path = ? WHERE id = ?', [table, logoPath, id]);
    if (rows[0].logo_path) await removeFile(publicFilePath(rows[0].logo_path));
    res.json({ message: 'Logo saved', logo_path: logoPath });
  };
}

const setFestLogo = makeLogoHandler('fests');
const setClubLogo = makeLogoHandler('clubs');

module.exports = {
  setPoster,
  removePoster,
  uploadEventFile,
  renameEventFile,
  deleteEventFile,
  downloadFile,
  setFestLogo,
  setClubLogo,
};