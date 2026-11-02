const pool = require('../db/pool');
const { can } = require('../services/permissionService');
const { unique } = require('../services/eventService');
const { notify } = require('../services/notificationService');
const { getCandidates, makeCode, loadCertificate, writeCertificatePdf } = require('../services/certificateService');
const { EVENT_LIFECYCLE, EVENT_PERMISSIONS } = require('../config/constants');

// Just the fields can() needs, from a certificate row
function eventOf(c) {
  return { id: c.event_id, created_by: c.created_by, kind: c.kind, scope: c.scope, status: c.status, fest_id: c.fest_id, club_id: c.club_id };
}

// GET /events/:id/certificates   (requires 'certificates')
async function listForEvent(req, res) {
  const event = req.event;
  const data = await getCandidates(event);
  res.json({
    criteria: event.certificate_criteria,
    min_attendance_percent: event.min_attendance_percent,
    lifecycle: event.lifecycle,
    ...data,
  });
}

// POST /events/:id/certificates/issue   { type, user_ids?, awards? }
async function issue(req, res) {
  const event = req.event;
  if (event.lifecycle !== EVENT_LIFECYCLE.COMPLETED) {
    return res.status(409).json({ message: 'Certificates can be issued once the event has ended' });
  }

  const type = req.body.type;
  const { participants } = await getCandidates(event);
  let rows = []; // [{ user_id, rank_label }]

  if (type === 'participation') {
    if (event.certificate_criteria === 'none') {
      return res.status(409).json({ message: 'This event does not give participation certificates' });
    }
    const only = req.body.user_ids ? new Set(req.body.user_ids) : null;
    rows = participants
      .filter((p) => p.qualifies && (!only || only.has(p.user_id)))
      .map((p) => ({ user_id: p.user_id, rank_label: null }));
  } else if (type === 'merit') {
    const awards = req.body.awards || [];
    if (awards.length === 0) return res.status(400).json({ message: 'Add at least one award' });
    const confirmed = new Set(participants.map((p) => p.user_id));
    if (awards.some((a) => !confirmed.has(a.user_id))) {
      return res.status(400).json({ message: 'Merit certificates are only for confirmed participants' });
    }
    const byUser = new Map();
    for (const a of awards) if (!byUser.has(a.user_id)) byUser.set(a.user_id, a.rank_label);
    rows = [...byUser].map(([userId, rank]) => ({ user_id: userId, rank_label: rank }));
  } else {
    const ids = unique(req.body.user_ids || []);
    if (ids.length === 0) return res.status(400).json({ message: 'Choose at least one person' });
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM users WHERE id IN (?) AND is_active = 1', [ids]);
    if (total !== ids.length) return res.status(400).json({ message: 'Some of these people were not found' });
    rows = ids.map((id) => ({ user_id: id, rank_label: null }));
  }




    // A delegate (no 'manage') cannot award themselves merit or appreciation
  if (type !== 'participation' && !req.eventPermissions.includes(EVENT_PERMISSIONS.MANAGE)
      && rows.some((r) => r.user_id === req.user.id)) {
    return res.status(403).json({ message: 'You cannot award a certificate to yourself. Ask an event manager.' });
  }


  
  // Leave out people who already hold this type for this event
  const [existing] = await pool.query('SELECT user_id FROM certificates WHERE event_id = ? AND type = ?', [event.id, type]);
  const already = new Set(existing.map((e) => e.user_id));
  const fresh = rows.filter((r) => !already.has(r.user_id));
  const skipped = rows.length - fresh.length;

  if (fresh.length === 0) {
    return res.json({ message: rows.length === 0 ? 'Nobody qualifies yet' : 'Everyone already has this certificate', issued: 0, skipped });
  }

  const year = event.end_time.slice(0, 4);
  await pool.query(
    'INSERT INTO certificates (certificate_code, event_id, user_id, type, rank_label, issued_by) VALUES ?',
    [fresh.map((r) => [makeCode(year), event.id, r.user_id, type, r.rank_label, req.user.id])]
  );

  await notify(
    fresh.map((r) => r.user_id),
    `Your certificate for ${event.title} is ready to download.`,
    '/me/certificates'
  );

  res.status(201).json({
    message: `${fresh.length} certificate(s) issued${skipped ? `, ${skipped} already had one` : ''}`,
    issued: fresh.length,
    skipped,
  });
}

// DELETE /certificates/:id   (needs 'certificates' on its event)
async function revoke(req, res) {
  const c = await loadCertificate(req.params.id);
  if (!c || !(await can(req.user, eventOf(c), EVENT_PERMISSIONS.CERTIFICATES))) {
    return res.status(404).json({ message: 'Certificate not found' });
  }
  await pool.query('DELETE FROM certificates WHERE id = ?', [c.id]);
  res.json({ message: `Certificate ${c.certificate_code} revoked` });
}

// GET /me/certificates
async function listMine(req, res) {
  const [rows] = await pool.query(
    `SELECT c.id, c.certificate_code, c.type, c.rank_label, c.issued_at,
            e.id AS event_id, e.title, e.start_time, e.end_time
       FROM certificates c
       JOIN events e ON e.id = c.event_id
      WHERE c.user_id = ?
      ORDER BY c.issued_at DESC`,
    [req.user.id]
  );
  res.json(rows);
}

// GET /certificates/:id/pdf — the owner, or anyone with 'certificates' on the event (admins included)
async function downloadPdf(req, res) {
  const c = await loadCertificate(req.params.id);
  const allowed = c && (c.user_id === req.user.id || (await can(req.user, eventOf(c), EVENT_PERMISSIONS.CERTIFICATES)));
  if (!allowed) return res.status(404).json({ message: 'Certificate not found' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${c.certificate_code}.pdf"`);
  writeCertificatePdf(c, res);
}

module.exports = { listForEvent, issue, revoke, listMine, downloadPdf };