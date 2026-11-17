import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')] });

const bool = (value: string | undefined, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const int = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const ROOT_DIR = path.resolve(__dirname, '../../../..');

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: int(process.env.PORT, 4000),
  publicApiUrl: process.env.PUBLIC_API_URL ?? 'http://localhost:4000',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',

  mongoUri: process.env.MONGODB_URI?.trim() ?? '',
  accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',

  mediaDriver: (process.env.MEDIA_DRIVER ?? 'local') as 'local' | 's3',
  mediaOpen: bool(process.env.MEDIA_OPEN, false),
  mediaRoot: process.env.MEDIA_ROOT ?? path.join(ROOT_DIR, 'media'),
  dataRoot: path.join(ROOT_DIR, '.data'),

  aws: {
    region: process.env.AWS_REGION ?? 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.S3_BUCKET ?? '',
  },
  cloudfront: {
    domain: process.env.CLOUDFRONT_DOMAIN ?? '',
    keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID ?? '',
    privateKey: (process.env.CLOUDFRONT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  },

  queueDriver: (process.env.QUEUE_DRIVER ?? 'local') as 'local' | 'bullmq',
  redisUrl: process.env.REDIS_URL ?? '',
  hlsRenditions: (process.env.HLS_RENDITIONS ?? '360,720')
    .split(',')
    .map((r) => Number(r.trim()))
    .filter((r) => [240, 360, 480, 720, 1080].includes(r)),
  segmentSeconds: int(process.env.HLS_SEGMENT_SECONDS, 4),

  paymentsDriver: (process.env.PAYMENTS_DRIVER ?? 'mock') as 'mock' | 'stripe',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  platformFeePct: int(process.env.PLATFORM_FEE_PCT, 20),

  liveDriver: (process.env.LIVE_DRIVER ?? 'simulated') as 'simulated' | 'livekit',
  livekit: {
    url: process.env.LIVEKIT_URL ?? '',
    apiKey: process.env.LIVEKIT_API_KEY ?? '',
    apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
  },
};

export const isStripeEnabled = () => env.paymentsDriver === 'stripe' && !!env.stripeSecretKey;
export const isLivekitEnabled = () =>
  env.liveDriver === 'livekit' && !!env.livekit.url && !!env.livekit.apiKey && !!env.livekit.apiSecret;
export const isS3Enabled = () => env.mediaDriver === 's3' && !!env.aws.bucket;
