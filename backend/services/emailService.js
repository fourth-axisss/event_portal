const nodemailer = require('nodemailer');

const configured = Boolean(process.env.MAIL_USER && process.env.MAIL_PASS);

// Built once at startup; null means "log mode"
const transporter = configured
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    })
  : null;

async function sendEmail({ to, subject, text }) {
  if (!transporter) {
    console.log(`[email not configured] To: ${to} | ${subject}`);
    return;
  }
  await transporter.sendMail({
    from: `"LNMIIT Events" <${process.env.MAIL_USER}>`,
    to,
    subject,
    text,
  });
}

module.exports = { sendEmail };