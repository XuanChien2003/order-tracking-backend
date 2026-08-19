const FIELD_LABELS = {
  username: 'Tên đăng nhập',
  contactEmail: 'Email liên hệ',
  vtpCode: 'Mã VTP',
  publicId: 'Mã định danh',
};

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: 'File vượt quá dung lượng cho phép',
  LIMIT_UNEXPECTED_FILE: 'Sai tên trường file tải lên',
  LIMIT_FILE_COUNT: 'Vượt quá số lượng file cho phép',
};

function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Đã xảy ra lỗi hệ thống';

  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${FIELD_LABELS[field] || field} đã tồn tại`;
  } else if (err.name === 'ValidationError') {
    status = 400;
  } else if (err.name === 'MulterError') {
    status = 400;
    message = MULTER_MESSAGES[err.code] || 'File tải lên không hợp lệ';
  } else if (status === 500) {
    message = 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau';
  }

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
