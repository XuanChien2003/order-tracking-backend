const Joi = require('joi');

const partnerRegisterSchema = Joi.object({
  companyName: Joi.string().trim().min(1).required(),
  contactEmail: Joi.string().trim().email().required(),
  contactPhone: Joi.string().trim().min(1).required(),
  password: Joi.string().min(8).required(),
});

// Admin-initiated creation never takes a password from the request - one is generated server-side
// and emailed to contactEmail instead (see partner.controller.js#adminCreate).
const partnerAdminCreateSchema = Joi.object({
  companyName: Joi.string().trim().min(1).required(),
  contactEmail: Joi.string().trim().email().required(),
  contactPhone: Joi.string().trim().min(1).required(),
});

// Partial update (PATCH) - admin-only, so at least one field must be provided.
const partnerUpdateSchema = Joi.object({
  companyName: Joi.string().trim().min(1),
  contactEmail: Joi.string().trim().email(),
  contactPhone: Joi.string().trim().min(1),
  status: Joi.string().valid('active', 'disabled'),
}).min(1);

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

module.exports = {
  partnerRegisterSchema,
  partnerAdminCreateSchema,
  partnerUpdateSchema,
  loginSchema,
  createUserSchema,
};
