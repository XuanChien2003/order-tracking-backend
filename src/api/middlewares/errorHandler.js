function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field} already exists`;
  } else if (err.name === 'ValidationError') {
    status = 400;
  } else if (err.name === 'MulterError') {
    status = 400;
  } else if (status === 500) {
    message = 'Internal server error';
  }

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
