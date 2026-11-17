import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@lumen/shared';
import { User } from '../models/user';
import { verifyAccessToken, verifyMediaToken, MEDIA_COOKIE } from '../lib/jwt';
import { forbidden, unauthorized } from '../lib/errors';
import { env } from '../config/env';

function bearer(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearer(req);
    if (!token) throw unauthorized();
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select('name email role status').lean();
    if (!user) throw unauthorized('Your session has expired');
    if (user.status === 'suspended') throw forbidden('This account is suspended');
    req.auth = { userId: String(user._id), role: user.role as Role, name: user.name };
    next();
  } catch (error) {
    next(error instanceof Error && 'status' in error ? error : unauthorized('Your session has expired'));
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select('name role status').lean();
    if (user && user.status !== 'suspended') {
      req.auth = { userId: String(user._id), role: user.role as Role, name: user.name };
    }
  } catch {
    /* anonymous */
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) return next(forbidden('This area is for ' + roles.join(' / ') + ' accounts'));
    next();
  };
}

/** Gate the /media static handler behind the signed playback cookie. */
export function requireMediaAccess(req: Request, res: Response, next: NextFunction) {
  if (env.mediaOpen) return next();
  const token = req.cookies?.[MEDIA_COOKIE];
  if (!token) return next(forbidden('Playback authorisation missing — open the lesson from the player'));
  try {
    verifyMediaToken(token);
    next();
  } catch {
    next(forbidden('Playback authorisation expired'));
  }
}
