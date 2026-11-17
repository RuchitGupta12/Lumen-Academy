import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { env, isLivekitEnabled } from '../config/env';
import { logger } from '../lib/logger';

export async function ensureLivekitRoom(roomName: string) {
  if (!isLivekitEnabled()) return;
  try {
    const client = new RoomServiceClient(env.livekit.url, env.livekit.apiKey, env.livekit.apiSecret);
    await client.createRoom({ name: roomName, emptyTimeout: 60 * 10, maxParticipants: 60 });
  } catch (error) {
    logger.warn({ error, roomName }, 'livekit room may already exist');
  }
}

export async function createLiveToken(input: {
  roomName: string;
  userId: string;
  name: string;
  isHost: boolean;
}) {
  if (!isLivekitEnabled()) {
    return { mode: 'simulated' as const, token: null, url: null };
  }

  const at = new AccessToken(env.livekit.apiKey, env.livekit.apiSecret, {
    identity: input.userId,
    name: input.name,
    ttl: '2h',
  });

  at.addGrant({
    room: input.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: input.isHost,
    roomCreate: input.isHost,
  });

  const token = await at.toJwt();
  return { mode: 'livekit' as const, token, url: env.livekit.url };
}

export const liveMode = () => (isLivekitEnabled() ? 'livekit' : 'simulated');
