import http from 'node:http';
import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env, isLivekitEnabled, isVercel, isStripeEnabled } from './config/env';
import { logger } from './lib/logger';
import { ensureMediaDirs } from './lib/media';
import { initSocket } from './realtime/socket';

// Export the Express app so Vercel's Express runtime can wrap it. Locally we
// also open a port so `npm run dev` / `npm start` work as before.
export const app = createApp();
export default app;

async function main() {
  ensureMediaDirs();

  const server = http.createServer(app);
  try {
    initSocket(server);
  } catch (error) {
    logger.warn({ error }, 'socket.io unavailable in this runtime');
  }

  if (isVercel) {
    try {
      await connectDb();
      logger.info('lumen api ready (vercel functions)');
    } catch (error) {
      // Keep the function alive: /health still answers and Runtime Logs show
      // the real MongoDB error instead of a generic invocation failure.
      logger.error({ error }, 'mongodb connection failed on vercel');
    }
    return;
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

main().catch((error) => {
  logger.error({ error }, 'failed to start api');
  if (!isVercel) process.exit(1);
});
