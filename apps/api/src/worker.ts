import { connectDb } from './config/db';
import { env } from './config/env';
import { logger } from './lib/logger';
import { ensureMediaDirs } from './lib/media';
import { startBullWorker } from './services/queue';

async function main() {
  ensureMediaDirs();
  await connectDb();

  if (env.queueDriver !== 'bullmq' || !env.redisUrl) {
    logger.warn(
      'queue driver is not bullmq — this process has nothing to consume. ' +
        'Set QUEUE_DRIVER=bullmq and REDIS_URL, or use the API process (QUEUE_DRIVER=local).',
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));
    process.exit(0);
  }

  const worker = await startBullWorker();
  logger.info('worker ready');

  const shutdown = async () => {
    logger.info('worker shutting down');
    await worker.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error({ error }, 'worker failed to start');
  process.exit(1);
});
