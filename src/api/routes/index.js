const express = require('express');
const partnersRoutes = require('./partners.routes');
const authRoutes = require('./auth.routes');
const ordersRoutes = require('./orders.routes');
const scansRoutes = require('./scans.routes');
const webhookRoutes = require('./webhook.routes');
const dashboardRoutes = require('./dashboard.routes');

const router = express.Router();

router.use('/partners', partnersRoutes);
router.use('/auth', authRoutes);
router.use('/orders', ordersRoutes);
router.use('/scans', scansRoutes);
router.use('/webhook', webhookRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;
