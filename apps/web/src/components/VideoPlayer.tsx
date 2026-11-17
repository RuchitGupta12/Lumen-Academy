import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { PlaybackPayload } from '../api';
import { useSaveProgressMutation } from '../api';
import { cn, duration, clamp } from '../lib/format';
import { Badge, Spinner } from './ui';

const RATES = [0.75, 1, 1.25, 1.5, 2];

/** Minimal surface of hls.js used by the player (keeps the dynamic import light). */
interface HlsHandle {
  destroy(): void;
  loadSource(url: string): void;
  attachMedia(el: HTMLVideoElement): void;
  on(event: string, cb: (event: string, data: unknown) => void): void;
}

export function VideoPlayer({
  payload,
  isLoading,
  onCompleted,
  autoReport = true,
}: {
  payload?: PlaybackPayload;
  isLoading?: boolean;
  onCompleted?: () => void;
  autoReport?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const lastReport = useRef(0);
  const watched = useRef(0);

  const [saveProgress] = useSaveProgressMutation();
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(payload?.durationSec ?? 0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [rateOpen, setRateOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);

  const ready = payload?.hlsUrl && (!payload.status || payload.status === 'ready');

  /* ── attach the HLS stream ───────────────────────────────────────────── */
  useEffect(() => {
    const video = videoRef.current;
    const src = payload?.hlsUrl;
    if (!video || !src) return;

    setFailed(false);
    setStarted(false);
    setPlaying(false);
    setCurrent(0);
    setTotal(payload?.durationSec ?? 0);
    lastReport.current = 0;
    watched.current = 0;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }

    let destroyed = false;
    let hls: HlsHandle | null = null;

    void (async () => {
      try {
        const mod = await import('hls.js');
        const Hls = mod.default;
        if (destroyed || !Hls.isSupported()) return;
        const instance: HlsHandle = new Hls({
          maxBufferLength: 24,
          enableWorker: true,
          xhrSetup: (xhr: XMLHttpRequest) => {
            // Signed media cookie (local driver) or CloudFront cookies (CDN driver).
            xhr.withCredentials = true;
          },
        });
        instance.on(Hls.Events.ERROR, (_event: string, data: unknown) => {
          const detail = data as { fatal?: boolean };
          if (detail?.fatal) setFailed(true);
        });
        instance.loadSource(src);
        instance.attachMedia(video);
        hls = instance;
      } catch {
        setFailed(true);
      }
    })();

    return () => {
      destroyed = true;
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [payload?.hlsUrl, payload?.durationSec]);

  /* ── report watch progress ───────────────────────────────────────────── */
  const report = useCallback(
    (completed = false) => {
      if (!autoReport || !payload?.lessonId || !ready) return;
      const seconds = Math.max(watched.current, completed ? (total || payload?.durationSec || 0) : 0);
      if (!completed && seconds - lastReport.current < 8) return;
      if (!completed && seconds < 1) return;
      lastReport.current = seconds;
      void saveProgress({ lessonId: payload.lessonId, watchedSeconds: Math.round(seconds), completed })
        .unwrap()
        .then(() => {
          if (completed) onCompleted?.();
        })
        .catch(() => undefined);
    },
    [autoReport, onCompleted, payload?.durationSec, payload?.lessonId, ready, saveProgress, total],
  );

  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      if (!videoRef.current?.paused) report();
    }, 12000);
    return () => window.clearInterval(id);
  }, [ready, report]);

  useEffect(() => () => report(), [report]);

  /* ── media events ────────────────────────────────────────────────────── */
  const onTime = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrent(video.currentTime);
    watched.current = Math.max(watched.current, video.currentTime);
    try {
      if (video.buffered.length) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const onFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setFailed(true));
    } else {
      video.pause();
    }
  };

  const seek = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrent(value);
  };

  const toggleFullscreen = async () => {
    if (!shellRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shellRef.current.requestFullscreen().catch(() => undefined);
  };

  const progressPct = total ? clamp((current / total) * 100, 0, 100) : 0;
  const bufferPct = total ? clamp((buffered / total) * 100, 0, 100) : 0;

  const overlayCopy = useMemo(() => {
    if (isLoading) return 'Loading lesson…';
    if (!payload) return 'Preparing this lesson…';
    if (payload.type && payload.type !== 'video') return 'This lesson has no video';
    if (!ready) {
      if (payload.status === 'failed') return 'Encoding failed — ask the instructor to re-upload';
      return `Video is ${payload.status ?? 'processing'}${payload.progress ? ` · ${payload.progress}%` : ''}`;
    }
    return '';
  }, [isLoading, payload, ready]);

  return (
    <div className="space-y-2">
      <div
        ref={shellRef}
        className="group relative overflow-hidden rounded-xl border border-line-strong bg-[#05070A] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]"
        onMouseLeave={() => setRateOpen(false)}
      >
        <div className="relative aspect-video w-full">
          <video
            ref={videoRef}
            className={cn('h-full w-full object-contain', !started && 'opacity-70')}
            poster={payload?.posterUrl ?? undefined}
            playsInline
            preload="metadata"
            onPlay={() => {
              setPlaying(true);
              setStarted(true);
            }}
            onPause={() => {
              setPlaying(false);
              report();
            }}
            onWaiting={() => setWaiting(true)}
            onPlaying={() => setWaiting(false)}
            onLoadedMetadata={(event) => {
              const value = event.currentTarget.duration;
              if (Number.isFinite(value)) setTotal(value);
            }}
            onTimeUpdate={onTime}
            onEnded={() => {
              setPlaying(false);
              report(true);
            }}
            onError={() => setFailed(true)}
            onClick={toggle}
          />

          {!started && ready && (
            <button
              onClick={toggle}
              aria-label="Play lesson"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/70 via-black/20 to-black/40 transition-opacity"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur transition-transform duration-200 hover:scale-105">
                <Play size={22} className="ml-1 fill-white" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/70">
                {duration(total || payload?.durationSec || 0)} · HLS adaptive
              </span>
            </button>
          )}

          {(overlayCopy || failed) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#05070A]/80 px-6 text-center backdrop-blur-sm">
              {isLoading || (!failed && ready) ? <Spinner /> : <RotateCcw size={20} className="text-muted" />}
              <p className="max-w-sm text-[12.5px] leading-relaxed text-muted">
                {failed ? 'The stream could not be loaded. Refresh, or reopen the lesson to renew playback access.' : overlayCopy}
              </p>
            </div>
          )}

          {waiting && started && !failed && !overlayCopy && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Spinner size={26} className="text-white/80" />
            </div>
          )}

          {started && !playing && !failed && !overlayCopy && (
            <button
              onClick={toggle}
              aria-label="Resume"
              className="absolute inset-0 flex items-center justify-center bg-black/25"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur">
                <Play size={18} className="ml-1 fill-white" />
              </span>
            </button>
          )}
        </div>

        {/* controls */}
        {ready && (
          <div className="absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2 pt-8 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100">
            <div
              className="group/seek relative mb-1.5 h-3 cursor-pointer"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                seek(((event.clientX - rect.left) / rect.width) * (total || 0));
              }}
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(total)}
              aria-valuenow={Math.round(current)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') seek(Math.min(total, current + 5));
                if (event.key === 'ArrowLeft') seek(Math.max(0, current - 5));
              }}
            >
              <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white/30" style={{ width: `${bufferPct}%` }} />
              </div>
              <div
                className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ember transition-[width] duration-100"
                style={{ width: `${progressPct}%` }}
              />
              <div
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember opacity-0 shadow transition-opacity group-hover/seek:opacity-100"
                style={{ left: `${progressPct}%` }}
              />
            </div>

            <div className="flex items-center gap-1.5 text-white">
              <button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} className="p-1">
                {playing ? <Pause size={16} className="fill-white" /> : <Play size={16} className="fill-white" />}
              </button>
              <span className="min-w-[74px] font-mono text-[10.5px] text-white/80">
                {duration(current)} / {duration(total)}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => {
                    const video = videoRef.current;
                    if (!video) return;
                    video.muted = !muted;
                    setMuted(!muted);
                  }}
                  aria-label="Mute"
                  className="p-1 text-white/80 hover:text-white"
                >
                  {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  aria-label="Volume"
                  className="h-1 w-14 cursor-pointer accent-ember"
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setVolume(next);
                    setMuted(next === 0);
                    if (videoRef.current) {
                      videoRef.current.volume = next;
                      videoRef.current.muted = next === 0;
                    }
                  }}
                />
                <div className="relative">
                  <button
                    onClick={() => setRateOpen((open) => !open)}
                    aria-label="Playback speed"
                    className="flex items-center gap-1 px-1 font-mono text-[10.5px] text-white/80 hover:text-white"
                  >
                    <Settings2 size={13} /> {rate}×
                  </button>
                  {rateOpen && (
                    <div className="absolute bottom-7 right-0 w-24 overflow-hidden rounded-lg border border-white/15 bg-[#0B0D11]/95 p-1 backdrop-blur">
                      {RATES.map((value) => (
                        <button
                          key={value}
                          onClick={() => {
                            setRate(value);
                            setRateOpen(false);
                            if (videoRef.current) videoRef.current.playbackRate = value;
                          }}
                          className={cn(
                            'block w-full rounded px-2 py-1 text-left font-mono text-[11px]',
                            value === rate ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5',
                          )}
                        >
                          {value}×
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => void toggleFullscreen()} aria-label="Fullscreen" className="p-1 text-white/80 hover:text-white">
                  {fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {started && (
          <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Badge tone="ink" className="border-white/15 bg-black/40 text-white/70">
              {rate}× · HLS
            </Badge>
          </div>
        )}
      </div>

      {payload?.thumbnailsUrl && (
        <p className="font-mono text-[10px] text-faint">
          Adaptive stream · 360p / 720p ladder · progress saved every 12 seconds
        </p>
      )}
    </div>
  );
}
