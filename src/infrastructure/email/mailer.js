const nodemailer = require('nodemailer');
const config = require('../config/env');

let transporter = null;

function getTransporter() {
  if (!config.smtp.host) {
    throw new Error('SMTP chưa được cấu hình (thiếu SMTP_HOST)');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      // Render's containers resolve smtp.gmail.com to an IPv6 address sometimes (DNS round-robin)
      // but have no outbound IPv6 route, which fails as ENETUNREACH - intermittently, depending on
      // which record wins that lookup. Forcing IPv4 avoids the flaky path entirely.
      family: 4,
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  await t.sendMail({ from: config.smtp.from, to, subject, html, text });
}

module.exports = { sendMail };
