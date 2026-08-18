const { sendMail } = require('../../infrastructure/email/mailer');

const WEB_APP_URL = (process.env.WEB_APP_URL || 'https://fe-wine-seven.vercel.app').replace(/\/$/, '');
const LOGIN_URL = `${WEB_APP_URL}/login`;
const PROFILE_URL = `${WEB_APP_URL}/profile`;
const LOGO_URL = `${WEB_APP_URL}/Logo.png`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendPartnerCredentialsEmail({ to, companyName, username, password }) {
  const safeCompanyName = escapeHtml(companyName);
  const safeUsername = escapeHtml(username);
  const safePassword = escapeHtml(password);
  const subject = 'Tài khoản đối tác New Horizon Logistics của bạn';
  const html = `
    <div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Arial,sans-serif;color:#1f2937">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="padding:28px 32px 20px;text-align:center;background:#ffffff;border-bottom:1px solid #eef1f6">
          <img src="${LOGO_URL}" alt="New Horizon Logistics" width="132" style="display:block;margin:0 auto;max-width:132px;height:auto" />
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 16px;font-size:22px;color:#102a56">Tài khoản của bạn đã sẵn sàng</h1>
          <p style="margin:0 0 16px;line-height:1.6">Xin chào <strong>${safeCompanyName}</strong>,</p>
          <p style="margin:0 0 20px;line-height:1.6">Quản trị viên đã tạo tài khoản đối tác New Horizon Logistics cho bạn. Thông tin đăng nhập:</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;background:#f4f7fb;border-radius:8px">
            <tr><td style="padding:16px"><strong>Tên đăng nhập:</strong> ${safeUsername}<br /><span style="display:block;height:8px"></span><strong>Mật khẩu tạm thời:</strong> ${safePassword}</td></tr>
          </table>
          <div style="text-align:center;margin:0 0 24px"><a href="${LOGIN_URL}" style="display:inline-block;padding:12px 22px;background:#2563eb;border-radius:6px;color:#ffffff;text-decoration:none;font-weight:bold">Đăng nhập hệ thống</a></div>
          <p style="margin:0 0 10px;line-height:1.6">Để bảo mật, hãy đổi mật khẩu ngay sau lần đăng nhập đầu tiên tại <a href="${PROFILE_URL}" style="color:#2563eb">Trang cá nhân</a>.</p>
          <p style="margin:0;line-height:1.6;font-size:13px;color:#6b7280">Nếu nút không hoạt động, mở: <a href="${LOGIN_URL}" style="color:#2563eb">${LOGIN_URL}</a></p>
        </td></tr>
      </table>
    </div>
  `;
  const text = `Xin chào ${companyName},

Quản trị viên đã tạo tài khoản đối tác New Horizon Logistics cho bạn.
Tên đăng nhập: ${username}
Mật khẩu tạm thời: ${password}

Đăng nhập tại: ${LOGIN_URL}
Sau khi đăng nhập, đổi mật khẩu tại: ${PROFILE_URL}
`;
  await sendMail({ to, subject, html, text });
}

module.exports = { sendPartnerCredentialsEmail };
