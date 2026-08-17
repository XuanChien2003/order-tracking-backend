const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Used for admin-provisioned accounts (e.g. partner creation) where the account owner never
// picks their own password - one gets generated here and emailed to them instead. Built from
// crypto.randomBytes rather than Math.random, since it ends up as a real login credential.
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
function generateTempPassword(length = 12) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += TEMP_PASSWORD_CHARS[bytes[i] % TEMP_PASSWORD_CHARS.length];
  }
  return out;
}

module.exports = { hashPassword, comparePassword, generateTempPassword };
