const mongoose = require('mongoose');
const { PARTNER_STATUS } = require('../constants/enums');

const partnerSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, unique: true },
    companyName: { type: String, required: true },
    contactEmail: { type: String, required: true, unique: true },
    contactPhone: { type: String, required: true },
    status: { type: String, enum: PARTNER_STATUS, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Partner', partnerSchema, 'partners');
