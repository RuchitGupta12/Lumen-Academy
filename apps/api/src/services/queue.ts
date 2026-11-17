import { env } from '../config/env';
import { logger } from '../lib/logger';
import { VideoAsset } from '../models/video';
import { emitJobProgress } from '../realtime/io';
import { markVideoFailed, processVideo } from './videoProcess';

export const VIDEO_QUEUE = 'lumen-video';

/** Shared job implementation: identical whether it runs in-process or in BullMQ. */
export async function runTranscodeJob(videoId: string) {
  const asset = await VideoAsset.findById(videoId).lean();
  if (!asset) throw new Error(`Video ${videoId} disappeared before processing`);

  let lastWritten = -1;
  try {
    await processVideo(videoId, (percent, stage) => {
      const rounded = Math.round(percent);
      if (rounded <= lastWritten && rounded !== 100) return;
      lastWritten = rounded;
      emitJobProgress(videoId, String(asset.instructor), rounded, stage);
      if (rounded % 4 === 0 || rounded === 100) {
        void VideoAsset.updateOne({ _id: videoId }, { $set: { progress: rounded } }).catch(() => undefined);
      }
    });
  } catch (error) {
    logger.error({ error, videoId }, 'transcode failed');
    await markVideoFailed(videoId, error);
    throw error;
  }
}

/* ─────────────────────────────  Local driver  ───────────────────────────── */

let tail: Promise<unknown> = Promise.resolve();
const localPending = new Set<string>();

function runLocal(videoId: string) {
  if (localPending.has(videoId)) return;
  localPending.add(videoId);
  tail = tail
    .then(() => runTranscodeJob(videoId))
    .catch((error) => logger.error({ error, videoId }, 'local transcode job failed'))
    .finally(() => localPending.delete(videoId));
}

/* ────────────────────────────  BullMQ driver  ───────────────────────────── */

let bullQueue: any = null;

async function getBullQueue() {
  if (bullQueue) return bullQueue;
  const { Queue } = await import('bullmq');
  const IORedis = (await import('ioredis')).default;
  const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
  bullQueue = new Queue(VIDEO_QUEUE, { connection });
  return bullQueue;
}

export async function enqueueTranscode(videoId: string) {
  await VideoAsset.updateOne(
    { _id: videoId },
    { $set: { status: 'queued', progress: 0, error: null } },
  );

  if (env.queueDriver === 'bullmq' && env.redisUrl) {
    const queue = await getBullQueue();
    const job = await queue.add(
      'transcode',
      { videoId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnKeep: 50 },
    );
    await VideoAsset.updateOne({ _id: videoId }, { $set: { jobId: String(job.id) } });
    logger.info({ videoId, jobId: job.id }, 'queued via bullmq');
    return { driver: 'bullmq', jobId: String(job.id) };
  }

  logger.info({ videoId }, 'queued via local driver');
  runLocal(videoId);
  return { driver: 'local', jobId: `local-${videoId}` };
}

export async function startBullWorker() {
  const { Worker } = await import('bullmq');
  const IORedis = (await import('ioredis')).default;
  const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
  const worker = new Worker(
    VIDEO_QUEUE,
    async (job: any) => runTranscodeJob(job.data.videoId),
    { connection, concurrency: 1 },
  );
  worker.on('completed', (job: any) => logger.info({ jobId: job.id }, 'bullmq job completed'));
  worker.on('failed', (job: any, error: Error) =>
    logger.error({ jobId: job?.id, error: error?.message }, 'bullmq job failed'),
  );
  logger.info('bullmq worker started');
  return worker;
}
