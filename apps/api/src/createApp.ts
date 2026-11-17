import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env, isLivekitEnabled, isStripeEnabled } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler, send, unauthorized } from './lib/errors';
import { requireMediaAccess } from './middleware/auth';
import { mediaPaths } from './lib/media';
import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';
import mediaRoutes from './routes/media';
import learningRoutes from './routes/learning';
import liveRoutes from './routes/live';
import paymentRoutes from './routes/payments';
import webhookRoutes from './routes/webhooks';
import instructorRoutes from './routes/instructor';
import adminRoutes from './routes/admin';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: [env.clientOrigin, 'http://localhost:4173', 'http://127.0.0.1:5173'],
      credentials: true,
    }),
  );
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  // Stripe needs the raw body — mount before the JSON parser.
  app.use('/api/v1/webhooks', webhookRoutes);

  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      data: {
        service: 'lumen-api',
        uptime: Math.round(process.uptime()),
        drivers: {
          media: env.mediaDriver,
          queue: env.queueDriver === 'bullmq' && env.redisUrl ? 'bullmq' : 'local',
          payments: isStripeEnabled() ? 'stripe' : 'mock',
          live: isLivekitEnabled() ? 'livekit' : 'simulated',
        },
      },
    });
  });

  app.get('/api/v1/config', (_req, res) =>
    send(res, {
      media: env.mediaDriver,
      payments: isStripeEnabled() ? 'stripe' : 'mock',
      live: isLivekitEnabled() ? 'livekit' : 'simulated',
      queue: env.queueDriver === 'bullmq' && env.redisUrl ? 'bullmq' : 'local',
      platformFeePct: env.platformFeePct,
      completionThreshold: 90,
    }),
  );

  const authLimiter = rateLimit({
    windowMs: 60_000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: { code: 'rate_limited', message: 'Too many attempts — try again shortly' } },
  });

  app.use('/api/v1/auth', authLimiter, authRoutes);
  app.use('/api/v1/courses', courseRoutes);
  app.use('/api/v1/media', mediaRoutes);
  app.use('/api/v1/live', liveRoutes);
  app.use('/api/v1', learningRoutes);
  app.use('/api/v1', paymentRoutes);
  app.use('/api/v1/instructor', instructorRoutes);
  app.use('/api/v1/admin', adminRoutes);

  app.use('/api/v1/auth/admin', (req, _res, next) => next(unauthorized(`No route for ${req.originalUrl}`)));

  // HLS segments + certificates, gated by the signed playback cookie.
  app.use(
    '/media',
    requireMediaAccess,
    express.static(env.mediaRoot, {
      maxAge: '7d',
      fallthrough: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.m3u8')) {
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          res.setHeader('Cache-Control', 'public, max-age=5');
        }
        if (filePath.endsWith('.m4s') || filePath.endsWith('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4');
        }
        res.setHeader('Access-Control-Allow-Origin', env.clientOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      },
    }),
  );

  // Serve the built SPA when it exists (single-process demo mode).
  const webDist = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^\/(?!api|media|health).*/, (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const paths = { mediaPaths };
