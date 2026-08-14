const userService = require('../../application/services/user.service');

async function create(req, res) {
  const user = await userService.createUser(req.body);
  res.status(201).json({
    publicId: user.publicId,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    isActive: user.isActive,
  });
}

async function list(req, res) {
  const items = await userService.listUsers();
  res.json({ items });
}

module.exports = { create, list };
