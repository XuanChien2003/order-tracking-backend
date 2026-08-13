function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      res.status(400).json({ error: message });
      return;
    }
    req.body = value;
    next();
  };
}

module.exports = { validateBody };
