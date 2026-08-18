function notFound(req, res) {
  res.status(404).json({ error: 'Không tìm thấy đường dẫn' });
}

module.exports = notFound;
