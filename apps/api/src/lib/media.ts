import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Response } from 'express';
import { env, isS3Enabled } from '../config/env';
import { setMediaCookie } from './jwt';
import { logger } from './logger';

export const mediaPaths = {
  root: env.mediaRoot,
  uploads: path.join(env.mediaRoot, 'uploads'),
  hls: path.join(env.mediaRoot, 'hls'),
  certificates: path.join(env.mediaRoot, 'certificates'),
};

export function ensureMediaDirs() {
  for (const dir of Object.values(mediaPaths)) fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(env.dataRoot, { recursive: true });
}

export const hlsDir = (videoId: string) => path.join(mediaPaths.hls, videoId);
export const manifestFile = (videoId: string) => path.join(hlsDir(videoId), 'master.m3u8');
export const posterFile = (videoId: string) => path.join(hlsDir(videoId), 'poster.jpg');
export const thumbsFile = (videoId: string) => path.join(hlsDir(videoId), 'thumbs.vtt');
export const certificateFile = (serial: string) => path.join(mediaPaths.certificates, `${serial}.pdf`);

const cdnBase = () =>
  env.cloudfront.domain && !env.cloudfront.domain.startsWith('http')
    ? `https://${env.cloudfront.domain}`
    : env.cloudfront.domain;

export function manifestUrl(videoId: string) {
  if (isS3Enabled() && cdnBase()) return `${cdnBase()}/hls/${videoId}/master.m3u8`;
  return `/media/hls/${videoId}/master.m3u8`;
}

export function posterUrl(videoId: string) {
  if (isS3Enabled() && cdnBase()) return `${cdnBase()}/hls/${videoId}/poster.jpg`;
  return `/media/hls/${videoId}/poster.jpg`;
}

export function thumbnailsUrl(videoId: string) {
  if (isS3Enabled() && cdnBase()) return `${cdnBase()}/hls/${videoId}/thumbs.vtt`;
  return `/media/hls/${videoId}/thumbs.vtt`;
}

export function certificateUrl(serial: string) {
  if (isS3Enabled() && cdnBase()) return `${cdnBase()}/certificates/${serial}.pdf`;
  return `/media/certificates/${serial}.pdf`;
}

export function newId() {
  return crypto.randomUUID();
}

export function newSerial() {
  const year = new Date().getFullYear();
  const body = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `LMN-${year}-${body}`;
}

/* ─────────────────────────────  Uploads  ───────────────────────────── */

async function s3Client() {
  const { S3Client } = await import('@aws-sdk/client-s3');
  return new S3Client({
    region: env.aws.region,
    credentials: {
      accessKeyId: env.aws.accessKeyId,
      secretAccessKey: env.aws.secretAccessKey,
    },
  });
}

export interface UploadTicket {
  driver: 'local' | 's3';
  method: 'POST' | 'PUT';
  url: string;
  headers?: Record<string, string>;
  key: string;
}

export async function createUploadTicket(
  videoId: string,
  filename: string,
  contentType: string,
): Promise<UploadTicket> {
  const ext = path.extname(filename).toLowerCase() || '.mp4';
  const key = `raw/${videoId}/source${ext}`;

  if (isS3Enabled()) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = await s3Client();
    const command = new PutObjectCommand({
      Bucket: env.aws.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(client, command, { expiresIn: 60 * 30 });
    return { driver: 's3', method: 'PUT', url, headers: { 'Content-Type': contentType }, key };
  }

  return {
    driver: 'local',
    method: 'POST',
    url: `/api/v1/media/upload/${videoId}`,
    key,
  };
}

export async function downloadSource(key: string, destination: string) {
  if (!isS3Enabled()) return destination;
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await s3Client();
  const response = await client.send(new GetObjectCommand({ Bucket: env.aws.bucket, Key: key }));
  const body = response.Body as unknown as NodeJS.ReadableStream;
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createWriteStream(destination);
    body.pipe(stream);
    stream.on('finish', () => resolve());
    stream.on('error', reject);
    body.on('error', reject);
  });
  return destination;
}

const contentTypeFor = (file: string) => {
  if (file.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (file.endsWith('.m4s') || file.endsWith('.mp4')) return 'video/mp4';
  if (file.endsWith('.jpg')) return 'image/jpeg';
  if (file.endsWith('.vtt')) return 'text/vtt';
  return 'application/octet-stream';
};

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/** Push the finished HLS directory to S3 when the CDN driver is enabled. */
export async function publishVideoAssets(videoId: string) {
  if (!isS3Enabled()) return;
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await s3Client();
  const dir = hlsDir(videoId);
  for (const file of walk(dir)) {
    const relative = path.relative(dir, file).split(path.sep).join('/');
    await client.send(
      new PutObjectCommand({
        Bucket: env.aws.bucket,
        Key: `hls/${videoId}/${relative}`,
        Body: fs.createReadStream(file),
        ContentType: contentTypeFor(file),
        CacheControl: relative.endsWith('.m4s')
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=60',
      }),
    );
  }
  logger.info({ videoId }, 'published HLS assets to S3');
}

export async function publishCertificate(serial: string) {
  if (!isS3Enabled()) return;
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await s3Client();
  const file = certificateFile(serial);
  await client.send(
    new PutObjectCommand({
      Bucket: env.aws.bucket,
      Key: `certificates/${serial}.pdf`,
      Body: fs.createReadStream(file),
      ContentType: 'application/pdf',
    }),
  );
}

export async function removeVideoFiles(videoId: string) {
  fs.rmSync(hlsDir(videoId), { recursive: true, force: true });
}

/** Authorise the browser for HLS playback: signed cookie locally, CloudFront cookies in prod. */
export async function authorizePlayback(res: Response, userId: string) {
  if (isS3Enabled() && cdnBase() && env.cloudfront.keyPairId && env.cloudfront.privateKey) {
    const { getSignedCookies } = await import('@aws-sdk/cloudfront-signer');
    const cookies = getSignedCookies({
      url: `${cdnBase()}/*`,
      keyPairId: env.cloudfront.keyPairId,
      privateKey: env.cloudfront.privateKey,
      dateLessThan: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    const host = new URL(cdnBase()).hostname;
    for (const [name, value] of Object.entries(cookies)) {
      res.cookie(name, value as string, {
        domain: host,
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      });
    }
    return 'cloudfront' as const;
  }

  setMediaCookie(res, userId);
  return 'local' as const;
}
