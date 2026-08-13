const crypto = require('crypto');

// Avoid ambiguous characters (I, O, 0, 1) since codes end up on printed labels.
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function randomChars(length) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CHARSET[crypto.randomInt(0, CHARSET.length)];
  }
  return out;
}

// Random, non-sequential order code (see PROJECT_CONTEXT.md section 2): e.g. NXC-26-7K4P9M2Q
function generateInternalCode(date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  return `NXC-${yy}-${randomChars(CODE_LENGTH)}`;
}

module.exports = { generateInternalCode };
