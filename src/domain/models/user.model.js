const mongoose = require('mongoose');
const { USER_ROLES } = require('../constants/enums');

const userSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
    displayName: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// CK_Users_PartnerRole: role === 'partner' <=> partnerId is set.
userSchema.pre('validate', function enforcePartnerRoleConstraint(next) {
  if (this.role === 'partner' && !this.partnerId) {
    next(new Error('partnerId is required when role is partner'));
    return;
  }
  if (this.role !== 'partner' && this.partnerId) {
    next(new Error('partnerId must be null when role is not partner'));
    return;
  }
  next();
});

userSchema.index(
  { partnerId: 1 },
  { partialFilterExpression: { partnerId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('User', userSchema, 'users');
