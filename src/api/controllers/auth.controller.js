const authService = require('../../application/services/auth.service');

async function login(req, res) {
  const result = await authService.login(req.body);
  res.json(result);
}

async function changePassword(req, res) {
  await authService.changePassword({
    userPublicId: req.user.publicId,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
  });
  res.json({ success: true });
}

module.exports = { login, changePassword };
