const mongoose = require('mongoose');
const config = require('../config/env');

async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri);
  return mongoose.connection;
}

module.exports = { connectDb };
