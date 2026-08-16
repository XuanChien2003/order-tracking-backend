const app = require('./app');
const config = require('./infrastructure/config/env');
const { connectDb } = require('./infrastructure/db/mongoose');
const { ensureInitialData } = require('./infrastructure/db/autoSeed');
const webhookWorker = require('./infrastructure/jobs/webhookWorker');

async function start() {
  await connectDb();
  console.log('Connected to MongoDB');
  // Dev/CI convenience only - never runs unless explicitly opted into, and never in production
  // even if ENABLE_AUTO_SEED was left on by accident (e.g. copied from a dev .env).
  if (config.enableAutoSeed && config.nodeEnv !== 'production') {
    await ensureInitialData();
  }
  webhookWorker.start();
  app.listen(config.port, () => {
    console.log(`API listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
