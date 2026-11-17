import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Please sign in to continue') =>
  new ApiError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have access to this resource') =>
  new ApiError(403, 'forbidden', message);
export const notFound = (message = 'Not found') => new ApiError(404, 'not_found', message);
export const conflict = (message: string) => new ApiError(409, 'conflict', message);

export function send<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    ok: false,
    error: { code: 'not_found', message: `No route for ${req.method} ${req.originalUrl}` },
  });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      ok: false,
      error: {
        code: 'validation_failed',
        message: err.issues[0]?.message ?? 'Some fields need attention',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }

  if (err instanceof ApiError) {
    return res
      .status(err.status)
      .json({ ok: false, error: { code: err.code, message: err.message, details: err.details } });
  }

  const anyErr = err as { name?: string; code?: number; message?: string; stack?: string };
  if (anyErr?.name === 'CastError') {
    return res
      .status(400)
      .json({ ok: false, error: { code: 'bad_request', message: 'That identifier is not valid' } });
  }
  if (anyErr?.code === 11000) {
    return res.status(409).json({
      ok: false,
      error: { code: 'conflict', message: 'That record already exists' },
    });
  }
  if (anyErr?.name === 'MulterError') {
    return res.status(400).json({
      ok: false,
      error: { code: 'upload_failed', message: anyErr.message ?? 'Upload failed' },
    });
  }

  logger.error({ err, path: req.originalUrl, method: req.method }, 'unhandled error');
  res.status(500).json({
    ok: false,
    error: { code: 'internal_error', message: 'Something went wrong on our side' },
  });
}
