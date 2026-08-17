const sgMail = require('@sendgrid/mail');
const config = require('../config/env');

let initialized = false;

function ensureInitialized() {
  if (!config.sendgridApiKey) {
    throw new Error('Email chưa được cấu hình (thiếu SENDGRID_API_KEY)');
  }
  if (!config.emailFrom) {
    throw new Error('Email chưa được cấu hình (thiếu EMAIL_FROM - phải là email đã Single Sender Verification trên SendGrid)');
  }
  if (!initialized) {
    sgMail.setApiKey(config.sendgridApiKey);
    initialized = true;
  }
}

// Sends over HTTPS via SendGrid's API instead of raw SMTP - Render blocks outbound SMTP ports
// (25/465/587) entirely, which made a direct SMTP connection unusable no matter how it was
// configured (see git history on this file for the earlier SMTP/Resend attempts). SendGrid's
// Single Sender Verification lets EMAIL_FROM be a plain verified email address rather than
// requiring a whole owned+DNS-verified domain like Resend does.
async function sendMail({ to, subject, html, text }) {
  ensureInitialized();
  try {
    await sgMail.send({ to, from: config.emailFrom, subject, html, text });
  } catch (err) {
    const apiErrors = err.response?.body?.errors;
    const message = Array.isArray(apiErrors) ? apiErrors.map((e) => e.message).join('; ') : err.message;
    throw new Error(message);
  }
}

module.exports = { sendMail };
