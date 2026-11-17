export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function money(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format((cents ?? 0) / 100);
}

export function compactMoney(cents: number) {
  const value = (cents ?? 0) / 100;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(value)}`;
}

export function duration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function longDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function relativeDate(input: string | Date | null | undefined) {
  if (!input) return '—';
  const date = new Date(input);
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < hour) return rtf.format(Math.round(-diff / minute), 'minute');
  if (abs < day) return rtf.format(Math.round(-diff / hour), 'hour');
  if (abs < 30 * day) return rtf.format(Math.round(-diff / day), 'day');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fullDate(input: string | Date | null | undefined) {
  if (!input) return '—';
  return new Date(input).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function dateTime(input: string | Date | null | undefined) {
  if (!input) return '—';
  return new Date(input).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function initialGradient(from: string, to: string) {
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

export function minutesLabel(seconds: number) {
  const mins = Math.round((seconds || 0) / 60);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export const levelLabel: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const statusTone: Record<string, 'neutral' | 'ember' | 'verdigris' | 'ochre' | 'danger'> = {
  draft: 'neutral',
  in_review: 'ochre',
  published: 'verdigris',
  archived: 'neutral',
  ready: 'verdigris',
  processing: 'ochre',
  queued: 'ochre',
  uploaded: 'neutral',
  failed: 'danger',
  paid: 'verdigris',
  pending: 'ochre',
  refunded: 'neutral',
  live: 'ember',
  scheduled: 'neutral',
  ended: 'neutral',
  active: 'verdigris',
  suspended: 'danger',
};
