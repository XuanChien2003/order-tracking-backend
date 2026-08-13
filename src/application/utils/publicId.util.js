const { v4: uuidv4 } = require('uuid');

function generatePublicId() {
  return uuidv4();
}

module.exports = { generatePublicId };
