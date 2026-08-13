const dashboardService = require('../../application/services/dashboard.service');

async function stats(req, res) {
  const result = await dashboardService.getDashboardStats({ requester: req.user });
  res.json(result);
}

module.exports = { stats };
