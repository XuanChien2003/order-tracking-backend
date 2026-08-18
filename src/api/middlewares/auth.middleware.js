const { verifyAccessToken } = require('../../application/services/token.service');
const AppError = require('../../application/errors/AppError');
const { User, Partner } = require('../../domain/models');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(new AppError('Thiếu hoặc sai thông tin xác thực', 401));
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
    next(new AppError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn', 401));
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError('Không đủ quyền truy cập', 403));
      return;
    }
    next();
  };
}

// JWT only proves the account was active at issue time - a user disabled or a partner suspended
// afterward would otherwise keep full access until the token naturally expires (up to 24h). This
// adds one fresh DB read on top of the JWT check, for routes where that staleness window matters
// (mutating data or reading it in bulk) - not applied globally to keep the common read paths cheap.
async function requireActiveAccount(req, res, next) {
  try {
    const user = await User.findOne({ publicId: req.user.publicId }).select('isActive').lean();
    if (!user || !user.isActive) {
      next(new AppError('Tài khoản đã bị vô hiệu hóa', 403));
      return;
    }
    if (req.user.role === 'partner') {
      const partner = await Partner.findOne({ publicId: req.user.partnerId }).select('status').lean();
      if (!partner || partner.status !== 'active') {
        next(new AppError('Đối tác đã bị vô hiệu hóa', 403));
        return;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate, authorize, requireActiveAccount };
