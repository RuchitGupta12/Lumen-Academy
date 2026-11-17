import type { Role } from '@lumen/shared';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: Role; name: string };
    }
  }
}

export {};
