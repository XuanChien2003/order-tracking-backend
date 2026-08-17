const authService = require('../../application/services/auth.service');
const partnerService = require('../../application/services/partner.service');
const emailService = require('../../application/services/email.service');
const { generateTempPassword } = require('../../application/services/password.service');

function toPartnerPublic(partner) {
  return {
    publicId: partner.publicId,
    companyName: partner.companyName,
    contactEmail: partner.contactEmail,
    contactPhone: partner.contactPhone,
    status: partner.status,
    createdAt: partner.createdAt,
  };
}

async function register(req, res) {
  const { partner, user } = await authService.registerPartner(req.body);
  res.status(201).json({
    partner: toPartnerPublic(partner),
    user: {
      publicId: user.publicId,
      username: user.username,
      role: user.role,
    },
  });
}

// Admin-initiated creation - same underlying logic as self-service register, just gated by
// authenticate+authorize('admin') at the route instead of being public. The partner never types
// their own password here, so one is generated and emailed to their contactEmail instead of
// being returned in the response (the admin performing this isn't the account's owner).
async function adminCreate(req, res) {
  const tempPassword = generateTempPassword();
  const { partner, user } = await authService.registerPartner({ ...req.body, password: tempPassword });

  let emailSent = false;
  let emailError = null;
  try {
    await emailService.sendPartnerCredentialsEmail({
      to: partner.contactEmail,
      companyName: partner.companyName,
      username: user.username,
      password: tempPassword,
    });
    emailSent = true;
  } catch (err) {
    emailError = err.message;
    console.error(`[partner adminCreate] failed to email credentials to ${partner.contactEmail}:`, err.message);
  }

  res.status(201).json({
    partner: toPartnerPublic(partner),
    user: {
      publicId: user.publicId,
      username: user.username,
      role: user.role,
    },
    emailSent,
    emailError,
  });
}

async function list(req, res) {
  const includeAll = req.user?.role === 'admin' && req.query.status === 'all';
  const partners = await partnerService.listPartners({ includeAll });
  res.json({ items: partners.map(toPartnerPublic) });
}

async function update(req, res) {
  const partner = await partnerService.updatePartner({ publicId: req.params.publicId, updates: req.body });
  res.json(toPartnerPublic(partner));
}

module.exports = { register, adminCreate, list, update };
