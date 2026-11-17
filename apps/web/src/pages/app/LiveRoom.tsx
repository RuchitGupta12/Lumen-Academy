import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import {
  ArrowLeft,
  Mic,
  MicOff,
  Radio,
  Send,
  Settings2,
  Signal,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import type { ChatMessageDTO } from '@lumen/shared';
import { useAppSelector } from '../../hooks';
import {
  errorMessage,
  useLiveMessagesQuery,
  useLiveSessionQuery,
  useLiveTokenMutation,
  useSetLiveStatusMutation,
} from '../../api';
import { Avatar, Badge, Button, EmptyState, IconButton, Input, Skeleton, Spinner } from '../../components/ui';
import { dateTime, statusTone } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { cn } from '../../lib/format';

const LiveKitStage = lazy(() => import('./LiveKitStage').then((module) => ({ default: module.LiveKitStage })));

export default function LiveRoom() {
  const { sessionId = '' } = useParams();
  const { user, token } = useAppSelector((state) => state.auth);
  const toast = useToast();

  const { data: session, isLoading: sessionLoading } = useLiveSessionQuery(sessionId);
  const { data: initialMessages } = useLiveMessagesQuery(sessionId);
  const [getToken, { isLoading: tokenLoading }] = useLiveTokenMutation();
  const [setStatus, { isLoading: statusLoading }] = useSetLiveStatusMutation();

  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [draft, setDraft] = useState('');
  const [presence, setPresence] = useState(0);
  const [connected, setConnected] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [liveToken, setLiveToken] = useState<{ token: string; url: string; mode: string } | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);

  /* ── seed message history ──────────────────────────────────────────── */
  useEffect(() => {
    if (initialMessages) setMessages(initialMessages);
  }, [initialMessages]);

  /* ── request camera preview (simulated mode) ──────────────────────── */
  useEffect(() => {
    let active = true;
    if (!session || session.mode !== 'simulated') return;
    void navigator.mediaDevices
      ?.getUserMedia({ video: { width: 640, height: 480 }, audio: true })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraOn(true);
        setMicOn(stream.getAudioTracks().length > 0);
      })
      .catch(() => {
        // Camera permission is optional — the room still works with chat only.
      });
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [session?.mode, session?.id]);

  const toggleCamera = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCameraOn(track.enabled);
    } else {
      setCameraOn((value) => !value);
    }
  };
  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    } else {
      setMicOn((value) => !value);
    }
  };

  /* ── socket connection ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!user || !token || !sessionId) return;
    const socket = io({ auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('live:join', { sessionId }, (ack: { ok: boolean; error?: string }) => {
        if (!ack?.ok) setJoinError(ack?.error ?? 'Could not join the room');
        else setJoinError(null);
      });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socket.on('chat:new', (message: ChatMessageDTO) => {
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
    });
    socket.on('live:presence', (payload: { sessionId: string; count: number }) => {
      if (payload.sessionId === sessionId) setPresence(payload.count);
    });
    socket.on('live:status', (payload: { sessionId: string; status: string }) => {
      if (payload.sessionId === sessionId) toast.info('Room status updated', payload.status);
    });

    return () => {
      socket.emit('live:leave', { sessionId });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user?.id, token, sessionId, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !socketRef.current) return;
    socketRef.current.emit('chat:send', { sessionId, text }, (ack: { ok: boolean; error?: string }) => {
      if (!ack?.ok) toast.error('Message not sent', ack?.error);
      else setDraft('');
    });
  };

  const enter = async () => {
    try {
      const result = await getToken(sessionId).unwrap();
      if (result.mode === 'livekit' && result.token && result.url) {
        setLiveToken({ token: result.token, url: result.url, mode: result.mode });
      } else {
        setLiveToken({ token: '', url: '', mode: 'simulated' });
      }
    } catch (error) {
      toast.error('Could not enter room', errorMessage(error));
    }
  };

  const changeStatus = async (status: 'scheduled' | 'live' | 'ended') => {
    try {
      await setStatus({ id: sessionId, status }).unwrap();
      toast.success(`Class ${status}`);
    } catch (error) {
      toast.error('Could not update class', errorMessage(error));
    }
  };

  if (sessionLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Skeleton className="aspect-video rounded-xl" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  if (!session) {
    return (
      <EmptyState
        title="Room not found"
        description="This session may have been removed or you may not have access to it."
        action={<Link to="/app/live"><Button variant="secondary">Back to live classes</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/app/live" className="mb-2 inline-flex">
            <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />}>Live classes</Button>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] leading-tight text-ink">{session.title}</h1>
            <Badge tone={statusTone[session.status] ?? 'neutral'} dot={session.status === 'live'}>{session.status}</Badge>
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
            {dateTime(session.scheduledAt)} · {session.courseTitle ?? session.instructorName} · {session.mode} mode
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={connected ? 'verdigris' : 'neutral'} dot={connected}>
            {connected ? `${presence} in room` : 'disconnected'}
          </Badge>
          {session.isHost && (
            <>
              {session.status !== 'live' ? (
                <Button size="sm" variant="primary" icon={<Radio size={13} />} loading={statusLoading} onClick={() => void changeStatus('live')}>
                  Start class
                </Button>
              ) : (
                <Button size="sm" variant="danger" loading={statusLoading} onClick={() => void changeStatus('ended')}>
                  End class
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {joinError && (
        <div className="rounded-lg border border-danger/40 bg-danger/8 px-4 py-3 text-[12px] text-danger">{joinError}</div>
      )}

      {/* not in room yet */}
      {!liveToken ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface px-6 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-ember/35 bg-ember/10 text-ember">
            <Video size={26} />
          </span>
          <div>
            <h2 className="text-[20px] text-ink">Ready to join?</h2>
            <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-relaxed text-muted">
              Your camera and microphone preview will start locally. You can toggle them at any time, and the chat
              backchannel stays available throughout.
            </p>
          </div>
          <Button variant="primary" size="lg" icon={<Video size={16} />} loading={tokenLoading} onClick={() => void enter()}>
            Enter room
          </Button>
        </div>
      ) : liveToken.mode === 'livekit' ? (
        <Suspense fallback={<div className="flex aspect-video items-center justify-center rounded-xl border border-line bg-[#05070A]"><Spinner size={24} /></div>}>
          <LiveKitStage url={liveToken.url} token={liveToken.token} />
        </Suspense>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* stage */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {/* local camera */}
              <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-line-strong bg-[#05070A]">
                <video ref={videoRef} autoPlay playsInline muted className={cn('h-full w-full object-cover', !cameraOn && 'opacity-0')} />
                {!cameraOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                    <Avatar name={user?.name ?? 'You'} size={48} />
                    <span className="font-mono text-[10px] text-white/50">You · camera off</span>
                  </div>
                )}
                <span className="absolute left-2.5 top-2.5 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 font-mono text-[9px] text-white/80 backdrop-blur">
                  You {session.isHost ? '· Host' : ''}
                </span>
                {!micOn && (
                  <span className="absolute right-2.5 top-2.5 rounded-full bg-black/50 p-1 text-white/70 backdrop-blur"><MicOff size={12} /></span>
                )}
              </div>

              {/* simulated peers */}
              {[
                { name: session.instructorName ?? 'Instructor', tint: 'linear-gradient(145deg,#2C3E50,#0B0D11)', host: true },
                { name: 'Aarav Mehta', tint: 'linear-gradient(145deg,#1E2E2A,#0B0D11)' },
              ].map((peer) => (
                <div key={peer.name} className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-line bg-[#05070A]" style={{ background: peer.tint }}>
                  <Avatar name={peer.name} size={48} className="border-white/20 bg-black/30" />
                  <span className="absolute left-2.5 top-2.5 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 font-mono text-[9px] text-white/75 backdrop-blur">
                    {peer.name} {peer.host ? '· Host' : ''}
                  </span>
                </div>
              ))}
            </div>

            {/* controls */}
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-line bg-surface p-3">
              <IconButton label={cameraOn ? 'Turn camera off' : 'Turn camera on'} onClick={toggleCamera} className={cn('h-10 w-10', !cameraOn && 'border border-danger/40 text-danger')}>
                {cameraOn ? <Video size={17} /> : <VideoOff size={17} />}
              </IconButton>
              <IconButton label={micOn ? 'Mute microphone' : 'Unmute microphone'} onClick={toggleMic} className={cn('h-10 w-10', !micOn && 'border border-danger/40 text-danger')}>
                {micOn ? <Mic size={17} /> : <MicOff size={17} />}
              </IconButton>
              <span className="mx-1 h-6 w-px bg-line" />
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-faint">
                <Signal size={12} className="text-verdigris" /> Simulated room
              </span>
              <Button variant="ghost" size="sm" icon={<Settings2 size={13} />}>Device settings</Button>
            </div>

            <div className="rounded-lg border border-line bg-[color-mix(in_oklab,var(--c-surface)_55%,var(--c-canvas))] px-4 py-3 text-[11.5px] leading-relaxed text-muted">
              This is the simulated live driver — camera stays local, presence and chat are relayed over Socket.IO. Set{' '}
              <span className="font-mono text-ink">LIVE_DRIVER=livekit</span> with credentials to switch to a WebRTC SFU room.
            </div>
          </div>

          {/* chat */}
          <aside className="flex h-[560px] flex-col overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="label-caps">Class chat</p>
              <span className="flex items-center gap-1 font-mono text-[9.5px] text-faint"><Users size={11} /> {presence}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {messages.length === 0 ? (
                <p className="px-2 py-8 text-center text-[11.5px] text-faint">No messages yet. Say hello.</p>
              ) : (
                messages.map((message) => {
                  const isMine = message.userId === user?.id;
                  const isSystem = (message as ChatMessageDTO & { kind?: string }).kind === 'system';
                  if (isSystem) {
                    return (
                      <div key={message.id} className="py-1 text-center">
                        <span className="rounded-full bg-raised px-2.5 py-1 font-mono text-[9.5px] text-faint">{message.text}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={message.id} className={cn('flex gap-2', isMine && 'flex-row-reverse')}>
                      <Avatar name={message.userName} size={24} />
                      <div className={cn('max-w-[80%] rounded-lg px-2.5 py-1.5', isMine ? 'bg-ember/12' : 'bg-raised')}>
                        <p className="font-mono text-[9px] text-muted">{message.userName}</p>
                        <p className="mt-0.5 text-[11.5px] leading-snug text-ink">{message.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-3">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Message the class…"
                className="h-9 text-[12px]"
                disabled={!connected}
              />
              <Button type="submit" variant="primary" size="sm" disabled={!draft.trim() || !connected} icon={<Send size={13} />}>
                Send
              </Button>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}
