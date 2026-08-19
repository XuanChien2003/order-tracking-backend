const scanService = require('../../application/services/scan.service');
const { User } = require('../../domain/models');
const AppError = require('../../application/errors/AppError');

async function resolveActorUser(req) {
  const actorUser = await User.findOne({ publicId: req.user.publicId }).select('_id').lean();
  if (!actorUser) {
    throw new AppError('Không xác định được người thực hiện', 401);
  }
  return actorUser;
}

async function createScan(req, res) {
  const actorUser = await resolveActorUser(req);
  const { vtpCode, eventType, location, note, eventTime, requestId, lat, lng } = req.body;

  const result = await scanService.recordScan({
    vtpCode,
    eventType,
    location,
    note,
    eventTime,
    requestId,
    actorUserObjectId: actorUser._id,
    lat: typeof lat === 'number' ? lat : Number(lat),
    lng: typeof lng === 'number' ? lng : Number(lng),
  });

  res.status(200).json({
    idempotent: result.idempotent,
    internalCode: result.internalCode,
    eventType: result.event.eventType,
    eventTime: result.event.eventTime,
  });
}

async function scanHistory(req, res) {
  const actorUser = await resolveActorUser(req);
  const result = await scanService.getScanHistory({
    actorUserObjectId: actorUser._id,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json(result);
}

module.exports = { createScan, scanHistory };
