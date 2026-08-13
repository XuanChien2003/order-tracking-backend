const Joi = require('joi');

const partnerRegisterSchema = Joi.object({
  companyName: Joi.string().trim().min(1).required(),
  contactEmail: Joi.string().trim().email().required(),
  contactPhone: Joi.string().trim().min(1).required(),
  password: Joi.string().min(8).required(),
});

const loginSchema = Joi.object({
  username: Joi.string().trim().required(),
  password: Joi.string().required(),
});

module.exports = { partnerRegisterSchema, loginSchema };
