/*const pool = require('../db/pool');
const { sendEmail } = require('./emailService');

const APP_URL = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

async function sendNotificationEmails(userIds, message, link) {
  const [users] = await pool.query('SELECT email FROM users WHERE id IN (?) AND is_active = 1', [userIds]);
  const url = link ? `${APP_URL}${link}` : APP_URL;
  const text = `${message}\n\nOpen it here: ${url}\n\n— LNMIIT Events`;

  const results = await Promise.allSettled(
    users.map((u) => sendEmail({ to: u.email, subject: message.slice(0, 120), text }))
  );
  for (const r of results) {
    if (r.status === 'rejected') console.error('Email failed:', r.reason?.message);
  }
}



*/



const pool = require('../db/pool');
const { sendEmail } = require('./emailService');

const APP_URL = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

async function sendNotificationEmails(userIds, subject, body, link) {
  const [users] = await pool.query('SELECT email FROM users WHERE id IN (?) AND is_active = 1', [userIds]);
  const url = link ? `${APP_URL}${link}` : APP_URL;
  const text = `${body}\n\nOpen it here: ${url}\n\n— LNMIIT Events`;

  const results = await Promise.allSettled(users.map((u) => sendEmail({ to: u.email, subject: subject.slice(0, 120), text })));
  for (const r of results) {
    if (r.status === 'rejected') console.error('Email failed:', r.reason?.message);
  }
}



// Bell notification for each user (+ email in the background). Never throws.
// options.emailBody: a longer text for the email (the bell keeps the short message)
async function notify(userIds, message, link = null, { email = true, emailBody } = {}) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return;
  const text = message.slice(0, 300); // notifications.message is VARCHAR(300)

  try {
    await pool.query('INSERT INTO notifications (user_id, message, link) VALUES ?', [ids.map((id) => [id, text, link])]);
  } catch (err) {
    console.error('Could not save notifications:', err.message);
    return;
  }

  if (email) {
    // deliberately not awaited: the request should not wait for the mail server
    sendNotificationEmails(ids, text, emailBody || text, link).catch((err) => console.error('Email step failed:', err.message));
  }
}

module.exports = { notify };





/*

// Bell notification for each user (+ email in the background). Never throws.
async function notify(userIds, message, link = null, { email = true } = {}) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return;
  const text = message.slice(0, 300); // notifications.message is VARCHAR(300)

  try {
    await pool.query('INSERT INTO notifications (user_id, message, link) VALUES ?', [ids.map((id) => [id, text, link])]);
  } catch (err) {
    console.error('Could not save notifications:', err.message);
    return;
  }

  if (email) {
    // deliberately not awaited: the request should not wait for the mail server
    sendNotificationEmails(ids, text, link).catch((err) => console.error('Email step failed:', err.message));
  }
}

module.exports = { notify };

*/










