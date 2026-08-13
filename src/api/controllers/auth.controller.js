const authService = require('../../application/services/auth.service');

async function login(req, res) {
  const result = await authService.login(req.body);
  res.json(result);
}

module.exports = { login };
