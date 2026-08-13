const { verifyAccessToken } = require('../../application/services/token.service');
const AppError = require('../../application/errors/AppError');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(new AppError('Missing or invalid Authorization header', 401));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      publicId: payload.publicId,
      role: payload.role,
      partnerId: payload.partnerId || null,
    };
    next();
  } catch (err) {
    next(new AppError('Invalid or expired token', 401));
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError('Forbidden', 403));
      return;
    }
    next();
  };
}

module.exports = { authenticate, authorize };
