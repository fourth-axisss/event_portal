const crypto = require('crypto');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const pool = require('../db/pool');
const { publicFilePath } = require('./fileStorage');
const { REGISTRATION_STATUS } = require('../config/constants');

const CERTIFICATE_TYPES = ['participation', 'merit', 'organizer'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I look-alikes
const HEADINGS = {
  participation: 'Certificate of Participation',
  merit: 'Certificate of Merit',
  organizer: 'Certificate of Appreciation',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 'LNM-2026-K7Q2M9XD'
function makeCode(year) {
  let suffix = '';
  for (let i = 0; i < 8; i += 1) suffix += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return `LNM-${year}-${suffix}`;
}

function qualifies(event, participant, totalSessions) {
  if (event.certificate_criteria === 'attendance') {
    return totalSessions > 0 && participant.attended * 100 >= event.min_attendance_percent * totalSessions;
  }
  if (event.certificate_criteria === 'completion') return participant.completed === 1;
  return false;
}

// Everything the organizer's Certificates tab needs
async function getCandidates(event) {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM event_sessions WHERE event_id = ?', [event.id]);
  const [participants] = await pool.query(
    `SELECT r.id AS registration_id, r.completed, u.id AS user_id, u.name, u.roll_no,
            (SELECT COUNT(*) FROM session_attendance sa WHERE sa.registration_id = r.id) AS attended
       FROM registrations r
       JOIN users u ON u.id = r.user_id
      WHERE r.event_id = ? AND r.status = ?
      ORDER BY u.name`,
    [event.id, REGISTRATION_STATUS.CONFIRMED]
  );
  const [issued] = await pool.query(
    `SELECT c.id, c.user_id, c.type, c.rank_label, c.certificate_code, c.issued_at, u.name, u.roll_no
       FROM certificates c
       JOIN users u ON u.id = c.user_id
      WHERE c.event_id = ?
      ORDER BY FIELD(c.type, 'merit', 'participation', 'organizer'), u.name`,
    [event.id]
  );

  return {
    total_sessions: total,
    participants: participants.map((p) => ({
      ...p,
      total_sessions: total,
      qualifies: qualifies(event, p, total),
      issued: issued.filter((c) => c.user_id === p.user_id).map((c) => c.type),
    })),
    issued,
  };
}

// ---------- PDF ----------

// '2026-11-14 09:00:00' → '14 Nov 2026'  (read from the text, so no timezone shifting)
function formatDay(text) {
  const [y, m, d] = text.slice(0, 10).split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

function dateSpan(start, end) {
  const a = formatDay(start);
  const b = formatDay(end);
  return a === b ? a : `${a} to ${b}`;
}

// One certificate with everything needed to draw it and to check who may see it
async function loadCertificate(id) {
  const [[row]] = await pool.query(
    `SELECT c.id, c.certificate_code, c.type, c.rank_label, c.issued_at, c.user_id, c.event_id,
            u.name AS user_name, u.roll_no,
            e.title AS event_title, e.start_time, e.end_time, e.created_by, e.kind, e.scope, e.status,
            e.fest_id, e.club_id,
            v.name AS venue_name,
            cl.name AS club_name, cl.logo_path AS club_logo,
            cl.signatory_name AS club_signatory, cl.signatory_title AS club_signatory_title,
            f.name AS fest_name, f.logo_path AS fest_logo,
            f.signatory_name AS fest_signatory, f.signatory_title AS fest_signatory_title,
            o.name AS organizer_name
       FROM certificates c
       JOIN users u ON u.id = c.user_id
       JOIN events e ON e.id = c.event_id
       JOIN users o ON o.id = e.created_by
       LEFT JOIN venues v ON v.id = e.venue_id
       LEFT JOIN clubs cl ON cl.id = e.club_id
       LEFT JOIN fests f ON f.id = e.fest_id
      WHERE c.id = ?`,
    [id]
  );
  return row || null;
}

function writeCertificatePdf(c, output) {
  const MAROON = '#7e0914';
  const ORANGE = '#d25301';
  const INK = '#212727';
  const MUTED = '#6c7272';

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  doc.pipe(output);
  const W = doc.page.width;
  const H = doc.page.height;
  const x = 80;
  const centered = { width: W - 160, align: 'center' };

  // Frame
  doc.rect(20, 20, W - 40, H - 40).lineWidth(4).stroke(MAROON);
  doc.rect(30, 30, W - 60, H - 60).lineWidth(1).stroke(ORANGE);

  // Club or fest logo, if one was uploaded
  const logo = c.club_logo || c.fest_logo;
  if (logo) {
    const file = publicFilePath(logo);
    if (fs.existsSync(file)) doc.image(file, 55, 50, { fit: [70, 70] });
  }

  const organizerLine = [c.club_name, c.fest_name].filter(Boolean).join(' · ') || 'Faculty event';
  doc.fillColor(MAROON).font('Times-Bold').fontSize(18).text('The LNM Institute of Information Technology', x, 65, centered);
  doc.fillColor(MUTED).font('Helvetica').fontSize(11).text(organizerLine, x, 90, centered);

  doc.fillColor(INK).font('Times-Bold').fontSize(32).text(HEADINGS[c.type], x, 135, centered);
  doc.fillColor(MUTED).font('Helvetica').fontSize(13).text('This is to certify that', x, 200, centered);
  doc.fillColor(MAROON).font('Times-BoldItalic').fontSize(30).text(c.user_name, x, 225, centered);
  if (c.roll_no) doc.fillColor(MUTED).font('Helvetica').fontSize(11).text(c.roll_no, x, 262, centered);

  const line =
    c.type === 'organizer' ? 'contributed to organizing' : c.type === 'merit' ? `secured ${c.rank_label} in` : 'participated in';
  doc.fillColor(INK).font('Helvetica').fontSize(14).text(line, x, 290, centered);
  doc.fillColor(INK).font('Times-Bold').fontSize(22).text(c.event_title, x, 315, centered);
  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(12)
    .text(`held on ${dateSpan(c.start_time, c.end_time)}${c.venue_name ? ` at ${c.venue_name}` : ''}`, x, 352, centered);

  // Signature (club signatory → fest signatory → the event's organizer)
  const signatory = c.club_signatory || c.fest_signatory || c.organizer_name;
  const signatoryTitle = c.club_signatory
    ? c.club_signatory_title || 'Authorised Signatory'
    : c.fest_signatory
      ? c.fest_signatory_title || 'Authorised Signatory'
      : 'Event Organizer';
  const sigY = H - 135;
  doc.moveTo(W - 300, sigY).lineTo(W - 100, sigY).lineWidth(1).stroke(INK);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text(signatory, W - 300, sigY + 8, { width: 200, align: 'center' });
  doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(signatoryTitle, W - 300, sigY + 24, { width: 200, align: 'center' });

  // Code and date
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(`Certificate ID: ${c.certificate_code}`, x, sigY + 8);
  doc.text(`Issued on ${formatDay(c.issued_at)}`, x, sigY + 22);

  doc.end();
}

module.exports = { CERTIFICATE_TYPES, makeCode, qualifies, getCandidates, loadCertificate, writeCertificatePdf };