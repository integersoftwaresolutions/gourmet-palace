const { connectDB } = require('./config/db');
const { runCycle } = require('./workers/daily.worker');

let running = false;
let stopped = false;
async function tick() {
  if (running || stopped) return;
  running = true;
  try { await runCycle(); } catch (error) { console.error('[worker]', error); } finally { running = false; }
}

(async () => {
  await connectDB();
  console.log('[worker] started');
  await tick();
  const timer = setInterval(() => void tick(), 5 * 60 * 1000);
  const shutdown = (signal) => {
    console.log(`[worker] ${signal} received`);
    stopped = true;
    clearInterval(timer);
    const wait = () => running ? setTimeout(wait, 250) : process.exit(0);
    wait();
    setTimeout(() => process.exit(1), 15000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})().catch((error) => { console.error(error); process.exit(1); });
