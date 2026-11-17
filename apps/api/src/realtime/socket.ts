import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer, type Socket } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { verifyAccessToken } from '../lib/jwt';
import { User } from '../models/user';
import { ChatMessage, LiveSession } from '../models/live';
import { Enrollment } from '../models/learning';
import { setIO } from './io';

interface SocketUser {
  id: string;
  name: string;
  role: string;
}

export function initSocket(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    cors: { origin: [env.clientOrigin, 'http://localhost:4173'], credentials: true },
  });
  setIO(io);

  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth?.token as string) ?? '';
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).select('name role status').lean();
      if (!user || user.status === 'suspended') return next(new Error('unauthorised'));
      (socket.data as { user: SocketUser }).user = {
        id: String(user._id),
        name: user.name,
        role: user.role,
      };
      next();
    } catch {
      next(new Error('unauthorised'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket.data as { user: SocketUser }).user;
    socket.join(`user:${user.id}`);

    socket.on('video:watch', ({ videoId }: { videoId?: string } = {}) => {
      if (videoId) socket.join(`video:${videoId}`);
    });

    socket.on(
      'live:join',
      async ({ sessionId }: { sessionId?: string } = {}, ack?: (payload: unknown) => void) => {
        try {
          if (!sessionId) throw new Error('missing session');
          const session = await LiveSession.findById(sessionId).lean();
          if (!session) throw new Error('session not found');

          const enrolled = await Enrollment.exists({ student: user.id, course: session.course });
          const isHost = String(session.instructor) === user.id || user.role === 'admin';
          if (!enrolled && !isHost) throw new Error('enrol to join this class');

          socket.join(`live:${sessionId}`);
          const members = await io.in(`live:${sessionId}`).fetchSockets();
          io.to(`live:${sessionId}`).emit('live:presence', {
            sessionId,
            count: members.length,
            user: { id: user.id, name: user.name },
          });
          ack?.({ ok: true });
        } catch (error) {
          ack?.({ ok: false, error: (error as Error).message });
        }
      },
    );

    socket.on('live:leave', ({ sessionId }: { sessionId?: string } = {}) => {
      if (!sessionId) return;
      socket.leave(`live:${sessionId}`);
    });

    socket.on(
      'chat:send',
      async (
        { sessionId, text }: { sessionId?: string; text?: string } = {},
        ack?: (payload: unknown) => void,
      ) => {
        try {
          if (!sessionId || !text?.trim()) throw new Error('Say something first');
          const session = await LiveSession.findById(sessionId).lean();
          if (!session) throw new Error('Session not found');

          const enrolled = await Enrollment.exists({ student: user.id, course: session.course });
          const isHost = String(session.instructor) === user.id || user.role === 'admin';
          if (!enrolled && !isHost) throw new Error('Only enrolled learners can chat');

          const recent = await ChatMessage.countDocuments({
            session: sessionId,
            user: user.id,
            createdAt: { $gte: new Date(Date.now() - 10_000) },
          });
          if (recent > 5) throw new Error('Slow down a moment');

          const message = await ChatMessage.create({
            session: sessionId,
            user: user.id,
            userName: user.name,
            text: text.trim().slice(0, 600),
          });

          const payload = {
            id: String(message._id),
            userId: user.id,
            userName: user.name,
            text: message.text,
            createdAt: (message as any).createdAt?.toISOString?.() ?? new Date().toISOString(),
          };
          io.to(`live:${sessionId}`).emit('chat:new', payload);
          ack?.({ ok: true, message: payload });
        } catch (error) {
          ack?.({ ok: false, error: (error as Error).message });
        }
      },
    );

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('live:')) {
          const sessionId = room.slice(5);
          void io.in(room).fetchSockets().then((members) => {
            io.to(room).emit('live:presence', {
              sessionId,
              count: Math.max(0, members.length - 1),
              user: { id: user.id, name: user.name, left: true },
            });
          });
        }
      }
    });
  });

  logger.info('socket.io ready');
  return io;
}
