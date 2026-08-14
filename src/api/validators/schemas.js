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

// 'partner' is excluded here: partner accounts are created atomically with their Partner record
// via POST /partners/register, so allowing it here would let one get created without a partnerId.
const createUserSchema = Joi.object({
  username: Joi.string().trim().min(1).required(),
  password: Joi.string().min(8).required(),
  displayName: Joi.string().trim().min(1).required(),
  role: Joi.string().valid('admin', 'scanner').required(),
});

module.exports = { partnerRegisterSchema, loginSchema, createUserSchema };
