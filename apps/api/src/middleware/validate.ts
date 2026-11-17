import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { badRequest } from '../lib/errors';

type Part = 'body' | 'query' | 'params';

/**
 * Parse a request part with a zod schema and replace it with the parsed value.
 * Express 5 makes `req.query` a getter, so the parsed copy is stored on `res.locals`.
 */
export function validate(schema: ZodTypeAny, part: Part = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const issue = result.error.issues[0];
      return next(
        badRequest(issue?.message ?? 'That request is not valid', {
          path: issue?.path.join('.'),
          issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        }),
      );
    }
    if (part === 'body') req.body = result.data;
    else res.locals[part === 'query' ? 'query' : 'params'] = result.data;
    next();
  };
}

export const parsed = <T>(res: Response, part: Part): T =>
  (part === 'body' ? res.locals.body : res.locals[part]) as T;
