const { sendMail } = require('../../infrastructure/email/mailer');

// FR-10: partner accounts admin creates never get their password typed in by the partner
// themselves, so the credentials have to reach them some other way - email to the same
// contactEmail they registered with.
async function sendPartnerCredentialsEmail({ to, companyName, username, password }) {
  const subject = 'Tài khoản đối tác VTP Orders của bạn';
  const html = `
    <p>Xin chào <strong>${companyName}</strong>,</p>
    <p>Quản trị viên đã tạo tài khoản đối tác cho bạn trên hệ thống VTP Orders. Thông tin đăng nhập:</p>
    <ul>
      <li>Tên đăng nhập: <strong>${username}</strong></li>
      <li>Mật khẩu: <strong>${password}</strong></li>
    </ul>
    <p>Vui lòng giữ bí mật thông tin này. Nếu cần đổi mật khẩu, liên hệ quản trị viên.</p>
  `;
  const text = `Xin chào ${companyName},\n\nTài khoản đối tác VTP Orders của bạn:\nTên đăng nhập: ${username}\nMật khẩu: ${password}\n\nVui lòng giữ bí mật thông tin này. Nếu cần đổi mật khẩu, liên hệ quản trị viên.`;
  await sendMail({ to, subject, html, text });
}

module.exports = { sendPartnerCredentialsEmail };
