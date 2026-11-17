import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { downloadSource, ensureMediaDirs, hlsDir, mediaPaths, publishVideoAssets } from '../lib/media';
import { VideoAsset } from '../models/video';
import { Lesson } from '../models/lesson';
import { emitJobProgress } from '../realtime/io';
import { recomputeCourseStats, touchCourse } from './courseStats';

// ffmpeg-static / ffprobe-static ship binaries with the package — no system install required.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath: string = require('ffmpeg-static');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffprobePath: string = require('ffprobe-static').path;

interface ProgressReporter {
  (percent: number, stage: string): void;
}

function run(cmd: string, args: string[], onLine?: (line: string) => void) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      onLine?.(chunk.toString());
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with ${code}: ${stderr.slice(-1200)}`));
    });
  });
}

export async function probeDuration(file: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(ffprobePath, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      file,
    ]);
    let out = '';
    child.stdout.on('data', (c: Buffer) => (out += c.toString()));
    child.on('close', () => {
      const seconds = Number.parseFloat(out.trim());
      resolve(Number.isFinite(seconds) ? Math.round(seconds) : 0);
    });
    child.on('error', () => resolve(0));
  });
}

async function probeHeight(file: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(ffprobePath, [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=height',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      file,
    ]);
    let out = '';
    child.stdout.on('data', (c: Buffer) => (out += c.toString()));
    child.on('close', () => resolve(Number.parseInt(out.trim(), 10) || 720));
    child.on('error', () => resolve(720));
  });
}

function bitrateFor(height: number) {
  if (height >= 1080) return 4500;
  if (height >= 720) return 2500;
  if (height >= 480) return 1200;
  return 700;
}

const RENDITION_WIDTHS: Record<number, number> = {
  240: 426,
  360: 640,
  480: 854,
  720: 1280,
  1080: 1920,
};

function writeMasterPlaylist(dir: string, renditions: Array<{ height: number; bitrateKbps: number }>) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:7'];
  for (const rendition of renditions.sort((a, b) => a.height - b.height)) {
    const width = RENDITION_WIDTHS[rendition.height] ?? 640;
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bitrateKbps * 1000},RESOLUTION=${width}x${rendition.height},CODECS="avc1.4d401f,mp4a.40.2"`,
      `${rendition.height}/index.m3u8`,
    );
  }
  fs.writeFileSync(path.join(dir, 'master.m3u8'), lines.join('\n') + '\n');
}

function writeThumbnailsVtt(dir: string, durationSec: number, count: number) {
  const step = Math.max(1, durationSec / Math.max(1, count));
  const stamps = (seconds: number) => {
    const ms = Math.round(seconds * 1000);
    const h = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0');
    const s = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0');
    const milli = String(ms % 1000).padStart(3, '0');
    return `${h}:${m}:${s}.${milli}`;
  };
  const lines = ['WEBVTT', ''];
  for (let i = 0; i < count; i += 1) {
    lines.push(`${stamps(i * step)} --> ${stamps((i + 1) * step)}`, `thumbs/thumb_${String(i).padStart(3, '0')}.jpg`, '');
  }
  fs.writeFileSync(path.join(dir, 'thumbs.vtt'), lines.join('\n'));
}

/**
 * Full FFmpeg pipeline: probe → ladder transcode → poster → thumbnail track → publish.
 * Reports coarse-grained progress so the UI can animate a real percentage.
 */
export async function processVideo(videoId: string, onProgress: ProgressReporter) {
  ensureMediaDirs();
  const asset = await VideoAsset.findById(videoId).lean();
  if (!asset) throw new Error('Video asset not found');
  if (asset.status === 'ready') return;

  const dir = hlsDir(videoId);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const sourceKey = asset.originalKey as string;
  const localSource = path.resolve(env.mediaRoot, sourceKey);
  const workSource = path.join(dir, 'source');

  await VideoAsset.updateOne({ _id: videoId }, { $set: { status: 'processing', progress: 1, error: null } });
  onProgress(1, 'Preparing source');

  if (!fs.existsSync(localSource)) {
    await downloadSource(sourceKey, workSource);
  }

  const input = fs.existsSync(localSource) ? localSource : workSource;
  if (!fs.existsSync(input)) throw new Error('Source file is missing — re-upload the lesson video');

  const durationSec = await probeDuration(input);
  const sourceHeight = await probeHeight(input);
  const ladder = env.hlsRenditions.filter((h) => h <= Math.max(360, sourceHeight));
  const targetLadder = ladder.length ? ladder : [360];

  const renditions: Array<{ height: number; width: number; bitrateKbps: number; playlist: string }> = [];

  for (let index = 0; index < targetLadder.length; index += 1) {
    const height = targetLadder[index];
    const bitrate = bitrateFor(height);
    const outDir = path.join(dir, String(height));
    fs.mkdirSync(outDir, { recursive: true });
    onProgress(4 + (index / targetLadder.length) * 70, `Transcoding ${height}p`);

    const args = [
      '-y',
      '-i',
      input,
      '-vf',
      `scale=-2:${height}`,
      '-c:v',
      'libx264',
      '-profile:v',
      'main',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-maxrate',
      `${bitrate}k`,
      '-bufsize',
      `${bitrate * 2}k`,
      '-c:a',
      'aac',
      '-b:a',
      height >= 720 ? '128k' : '96k',
      '-ac',
      '2',
      '-ar',
      '48000',
      '-hls_time',
      String(env.segmentSeconds),
      '-hls_playlist_type',
      'vod',
      '-hls_segment_type',
      'fmp4',
      '-hls_flags',
      'independent_segments',
      '-hls_fmp4_init_filename',
      'init.mp4',
      '-hls_segment_filename',
      path.join(outDir, 'seg_%03d.m4s'),
      '-progress',
      'pipe:1',
      '-nostats',
      path.join(outDir, 'index.m3u8'),
    ];

    await run(ffmpegPath, args, (line) => {
      const match = /out_time_ms=(\d+)/.exec(line);
      if (!match) return;
      const encoded = Number(match[1]) / 1_000_000;
      if (!durationSec) return;
      const fraction = Math.min(1, encoded / durationSec);
      const overall = 4 + ((index + fraction) / targetLadder.length) * 70;
      onProgress(overall, `Transcoding ${height}p`);
    });

    renditions.push({
      height,
      width: RENDITION_WIDTHS[height] ?? 640,
      bitrateKbps: bitrate,
      playlist: `${height}/index.m3u8`,
    });
  }

  writeMasterPlaylist(dir, renditions);

  onProgress(78, 'Rendering poster frame');
  await run(ffmpegPath, [
    '-y',
    '-ss',
    String(Math.min(3, Math.max(0, durationSec / 4))),
    '-i',
    input,
    '-frames:v',
    '1',
    '-vf',
    'scale=1280:-2',
    '-q:v',
    '3',
    path.join(dir, 'poster.jpg'),
  ]).catch(() => undefined);

  onProgress(86, 'Building thumbnail track');
  const thumbsDir = path.join(dir, 'thumbs');
  fs.mkdirSync(thumbsDir, { recursive: true });
  const thumbCount = 10;
  await run(ffmpegPath, [
    '-y',
    '-i',
    input,
    '-vf',
    `fps=1/${Math.max(1, durationSec / thumbCount)},scale=320:-2`,
    '-frames:v',
    String(thumbCount),
    path.join(thumbsDir, 'thumb_%03d.jpg'),
  ]).catch(() => undefined);
  writeThumbnailsVtt(dir, Math.max(durationSec, 1), thumbCount);

  fs.rmSync(workSource, { force: true });

  onProgress(92, 'Publishing to CDN');
  await publishVideoAssets(videoId);

  await VideoAsset.updateOne(
    { _id: videoId },
    {
      $set: {
        status: 'ready',
        progress: 100,
        durationSec,
        renditions,
        posterKey: `hls/${videoId}/poster.jpg`,
        thumbnailsKey: `hls/${videoId}/thumbs.vtt`,
        manifestKey: `hls/${videoId}/master.m3u8`,
        processedAt: new Date(),
        error: null,
      },
    },
  );

  if (asset.lesson) {
    await Lesson.updateOne({ _id: asset.lesson }, { $set: { durationSec } });
  }
  await recomputeCourseStats(String(asset.course));
  await touchCourse(String(asset.course));

  onProgress(100, 'Ready');
  logger.info({ videoId, durationSec, renditions: renditions.length }, 'video processed');
}

export async function markVideoFailed(videoId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const asset = await VideoAsset.findByIdAndUpdate(
    videoId,
    { $set: { status: 'failed', error: message.slice(0, 500), progress: 0 } },
    { new: true },
  ).lean();
  if (asset) {
    emitJobProgress(videoId, String(asset.instructor), 0, 'Failed');
    emitToSafe(`video:${videoId}`, 'video:failed', { videoId, error: message.slice(0, 300) });
  }
}

function emitToSafe(room: string, event: string, payload: unknown) {
  // Imported lazily to avoid a cycle between queue → process → io
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { emitTo } = require('../realtime/io') as typeof import('../realtime/io');
  emitTo(room, event, payload);
}

export { mediaPaths };
