import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { env } from '../config/env';
import type { Role } from '@lumen/shared';

export interface AccessPayload {
  sub: string;
  role: Role;
  name: string;
}

export interface RefreshPayload {
  sub: string;
  v: 1;
}

const ACCESS_TTL = '30m';
export const REFRESH_COOKIE = 'lumen_refresh';
export const MEDIA_COOKIE = 'lumen_media';

export const signAccessToken = (payload: AccessPayload) =>
  jwt.sign(payload, env.accessSecret, { expiresIn: ACCESS_TTL });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.accessSecret) as AccessPayload & { iat: number; exp: number };

export const signRefreshToken = (userId: string) =>
  jwt.sign({ sub: userId, v: 1 }, env.refreshSecret, { expiresIn: '7d' });

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.refreshSecret) as RefreshPayload;

export function setRefreshCookie(res: Response, userId: string) {
  res.cookie(REFRESH_COOKIE, signRefreshToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}

/** Signed, scoped cookie that authorises HLS requests for 30 minutes. */
export function setMediaCookie(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId, aud: 'media' }, env.accessSecret, { expiresIn: '30m' });
  res.cookie(MEDIA_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/media',
    maxAge: 30 * 60 * 1000,
  });
}

export function verifyMediaToken(token: string) {
  const payload = jwt.verify(token, env.accessSecret) as jwt.JwtPayload;
  if (payload.aud !== 'media') throw new Error('Wrong audience');
  return payload;
}
