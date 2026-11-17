import http from 'node:http';
import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env, isLivekitEnabled, isVercel, isStripeEnabled } from './config/env';
import { logger } from './lib/logger';
import { ensureMediaDirs } from './lib/media';
import { initSocket } from './realtime/socket';

// Export the Express app so Vercel's Express runtime can wrap it.
export const app = createApp();
export default app;

// apps/api/package.json declares "type": "commonjs". Vercel's Express runtime
// reads module.exports for CommonJS packages (not exports.default), so publish
// the app in every form the runtime or a local tool might look for.
module.exports = app;
module.exports.default = app;
module.exports.app = app;

async function main() {
  ensureMediaDirs();

  const server = http.createServer(app);
  try {
    initSocket(server);
  } catch (error) {
    logger.warn({ error }, 'socket.io unavailable in this runtime');
  }

  await connectDb();

  server.listen(env.port, () => {
    const rows = [
      `  Lumen API        http://localhost:${env.port}`,
      `  Health           http://localhost:${env.port}/health`,
      `  Media driver     ${env.mediaDriver}${env.mediaOpen ? ' (open)' : ' (signed cookie)'}`,
      `  Queue driver     ${env.queueDriver === 'bullmq' && env.redisUrl ? 'bullmq' : 'local (in-process)'}`,
      `  Payments         ${isStripeEnabled() ? 'stripe test mode' : 'mock checkout'}`,
      `  Live classes     ${isLivekitEnabled() ? 'LiveKit Cloud' : 'simulated room'}`,
    ];
    logger.info(`lumen api listening\n${rows.join('\n')}`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

if (isVercel) {
  // Vercel owns the HTTP server and socket layer. Start only the database
  // connection in the background; failures are logged but never crash the
  // function, so /health stays answerable and Runtime Logs show the cause.
  void connectDb()
    .then(() => logger.info('lumen api ready (vercel functions)'))
    .catch((error) => logger.error({ error }, 'mongodb connection failed on vercel'));
} else {
  main().catch((error) => {
    logger.error({ error }, 'failed to start api');
    process.exit(1);
  });
}
