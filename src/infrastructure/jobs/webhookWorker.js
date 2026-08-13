const os = require('os');
const crypto = require('crypto');
const webhookService = require('../../application/services/webhook.service');

const POLL_INTERVAL_MS = 3000;
const WORKER_ID = `${os.hostname()}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;

let timer = null;
let ticking = false;

// Drains all currently claimable webhookInbox items, one at a time, each tick.
async function drainQueue() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const item = await webhookService.claimNextItem(WORKER_ID);
    if (!item) break;
    // eslint-disable-next-line no-await-in-loop
    await webhookService.processWebhookItem(item);
  }
}

async function tick() {
  if (ticking) return; // avoid overlapping ticks if a previous drain is still running
  ticking = true;
  try {
    await drainQueue();
  } catch (err) {
    console.error('webhookWorker tick failed', err);
  } finally {
    ticking = false;
  }
}

function start() {
  if (timer) return;
  timer = setInterval(tick, POLL_INTERVAL_MS);
  tick();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick, WORKER_ID };
