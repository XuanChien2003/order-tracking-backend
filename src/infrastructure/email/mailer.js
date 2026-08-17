const dns = require('dns');
const net = require('net');
const nodemailer = require('nodemailer');
const config = require('../config/env');

// nodemailer resolves the SMTP host itself before connecting, and decides whether to even try
// IPv4 vs IPv6 by checking which families the local machine's own network interfaces report as
// present (lib/shared/index.js#isFamilySupported) - not by checking what's actually routable.
// Render's containers report an IPv6 interface that isn't really routed to the internet, so that
// check passes and nodemailer picks an IPv6 A/AAAA record, which then fails with ENETUNREACH.
// A plain top-level `family: 4` transport option is not read anywhere in that path, so it has no
// effect - the only reliable fix is to resolve the A record ourselves with Node's real DNS
// resolver and hand nodemailer a literal IPv4 address, which makes it skip its own resolution
// entirely (`net.isIP(host)` short-circuits it). `servername` has to be set explicitly in that
// case or TLS SNI/certificate validation would run against the bare IP instead of the real host.
async function resolveIPv4(hostname) {
  if (net.isIP(hostname)) return hostname;
  const addresses = await dns.promises.resolve4(hostname);
  if (!addresses.length) {
    throw new Error(`Không phân giải được địa chỉ IPv4 cho ${hostname}`);
  }
  return addresses[0];
}

async function sendMail({ to, subject, html, text }) {
  if (!config.smtp.host) {
    throw new Error('SMTP chưa được cấu hình (thiếu SMTP_HOST)');
  }
  const ipv4Host = await resolveIPv4(config.smtp.host);
  const transporter = nodemailer.createTransport({
    host: ipv4Host,
    servername: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  await transporter.sendMail({ from: config.smtp.from, to, subject, html, text });
}

module.exports = { sendMail };
