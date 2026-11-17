import fs from 'node:fs';
import { Server as SocketServer } from 'socket.io';
import { logger } from '../lib/logger';

let io: SocketServer | null = null;

export function setIO(server: SocketServer) {
  io = server;
}

export function getIO() {
  return io;
}

/** Broadcast to everyone watching a processing job or live session. */
export function emitTo(rooms: string | string[], event: string, payload: unknown) {
  if (!io) return;
  const list = Array.isArray(rooms) ? rooms : [rooms];
  for (const room of list) io.to(room).emit(event, payload);
}

export function emitJobProgress(videoId: string, instructorId: string, progress: number, stage: string) {
  const payload = { videoId, progress: Math.round(progress), stage };
  emitTo([`video:${videoId}`, `user:${instructorId}`], 'video:progress', payload);
  if (progress >= 100) {
    emitTo([`video:${videoId}`, `user:${instructorId}`], 'video:ready', { videoId });
  }
  logger.debug(payload, 'video progress');
}
