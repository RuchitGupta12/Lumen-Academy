import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env, isVercel } from './env';
import { logger } from '../lib/logger';

const LOCAL_MONGO_PORT = 27099;
const LOCAL_MONGO_URI = `mongodb://127.0.0.1:${LOCAL_MONGO_PORT}/lumen`;

let memoryServer: { stop: () => Promise<boolean> } | null = null;

/**
 * Connection strategy:
 *  1. MONGODB_URI set        → connect to Atlas / any MongoDB.
 *  2. Otherwise, try local   → attach to an already-running bundled mongod
 *                              (e.g. the API already started it for the worker).
 *  3. Otherwise, start one   → mongodb-memory-server on a fixed port with a
 *                              persistent data dir so data survives restarts.
 */
export async function connectDb() {
  mongoose.set('strictQuery', true);

  if (env.mongoUri) {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10_000 });
    logger.info({ driver: 'external' }, 'mongodb connected');
    return;
  }

  if (isVercel) {
    throw new Error(
      'MONGODB_URI is required on Vercel: the bundled MongoDB needs a writable local filesystem and a listening port. Set MONGODB_URI to an Atlas connection string.',
    );
  }

  try {
    await mongoose.connect(LOCAL_MONGO_URI, { serverSelectionTimeoutMS: 1200 });
    logger.info({ driver: 'local-attach', uri: LOCAL_MONGO_URI }, 'mongodb connected');
    return;
  } catch {
    /* no running instance — start one below */
  }

  const dbPath = path.join(env.dataRoot, 'mongo');
  fs.mkdirSync(dbPath, { recursive: true });

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const server = await MongoMemoryServer.create({
    instance: {
      port: LOCAL_MONGO_PORT,
      dbName: 'lumen',
      dbPath,
      storageEngine: 'wiredTiger',
    },
  });
  memoryServer = server;
  await mongoose.connect(server.getUri('lumen'), { serverSelectionTimeoutMS: 10_000 });
  logger.info({ driver: 'local-memory', uri: server.getUri('lumen') }, 'mongodb connected');
}

export async function disconnectDb() {
  await mongoose.disconnect().catch(() => undefined);
  if (memoryServer) await memoryServer.stop().catch(() => undefined);
  memoryServer = null;
}
