import http from 'node:http';
import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env, isLivekitEnabled, isStripeEnabled } from './config/env';
import { logger } from './lib/logger';
import { ensureMediaDirs } from './lib/media';
import { initSocket } from './realtime/socket';

async function main() {
  ensureMediaDirs();
  await connectDb();

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

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
  process.exit(1);
});
