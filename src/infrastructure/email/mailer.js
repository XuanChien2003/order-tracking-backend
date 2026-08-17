const { Resend } = require('resend');
const config = require('../config/env');

let resend = null;

function getClient() {
  if (!config.resendApiKey) {
    throw new Error('Email chưa được cấu hình (thiếu RESEND_API_KEY)');
  }
  if (!resend) {
    resend = new Resend(config.resendApiKey);
  }
  return resend;
}

// Sends over HTTPS via Resend's API instead of raw SMTP - Render blocks outbound SMTP ports
// (25/465/587) entirely, which made a direct nodemailer->smtp.gmail.com connection unusable no
// matter how it was configured (see git history on this file for the two failed SMTP attempts).
async function sendMail({ to, subject, html, text }) {
  const client = getClient();
  const { error } = await client.emails.send({
    from: config.emailFrom,
    to,
    subject,
    html,
    text,
  });
  if (error) {
    throw new Error(error.message || 'Gửi email thất bại');
  }
}

module.exports = { sendMail };
