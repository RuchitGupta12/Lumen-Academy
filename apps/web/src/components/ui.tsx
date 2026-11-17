import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { cn } from '../lib/format';
import { initials } from '@lumen/shared';

/* ──────────────────────────────  Buttons  ───────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium tracking-[-0.01em] transition-all duration-150 disabled:opacity-45 disabled:pointer-events-none select-none whitespace-nowrap';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-ember text-[#160B06] hover:bg-[#ff7b52] active:bg-ember-deep shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]',
  secondary:
    'bg-raised text-ink border border-line-strong hover:border-ink/35 hover:bg-[color-mix(in_oklab,var(--c-raised)_70%,var(--c-ink)_6%)]',
  ghost: 'text-muted hover:text-ink hover:bg-[color-mix(in_oklab,var(--c-ink)_7%,transparent)]',
  danger: 'bg-danger/12 text-danger border border-danger/35 hover:bg-danger/20',
  outline: 'border border-line-strong text-ink hover:bg-[color-mix(in_oklab,var(--c-ink)_6%,transparent)]',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[12.5px]',
  md: 'h-10 px-4 text-[13.5px]',
  lg: 'h-12 px-6 text-[14.5px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  iconRight,
  block,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], block && 'w-full', className)}
    >
      {loading ? <Loader2 size={size === 'sm' ? 13 : 15} className="animate-spin" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[color-mix(in_oklab,var(--c-ink)_8%,transparent)] hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ──────────────────────────────  Fields  ────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="flex items-center gap-1 text-[12px] font-medium text-muted">
          {label}
          {required && <span className="text-ember">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[11.5px] leading-snug text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[11.5px] leading-snug text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

const controlBase =
  'w-full rounded-[9px] border border-line bg-[color-mix(in_oklab,var(--c-canvas)_70%,var(--c-surface))] px-3 text-[13.5px] text-ink placeholder:text-faint transition-colors hover:border-line-strong focus:border-ember/60 focus:outline-none focus:ring-2 focus:ring-ember/15 disabled:opacity-50';

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      className={cn(controlBase, 'h-10', invalid && 'border-danger/60 focus:border-danger focus:ring-danger/15', className)}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...rest}
      className={cn(controlBase, 'min-h-[96px] py-2.5 leading-relaxed', invalid && 'border-danger/60', className)}
    />
  );
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(controlBase, 'h-10 cursor-pointer appearance-none pr-8', className)}>
      {children}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full border transition-colors',
          checked ? 'border-ember/60 bg-ember' : 'border-line-strong bg-raised',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] h-[16px] w-[16px] rounded-full bg-[#0B0D11] transition-transform',
            checked ? 'translate-x-[18px] bg-[#160B06]' : 'translate-x-[2px] bg-faint',
          )}
        />
      </button>
      <span className="flex flex-col">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {description && <span className="text-[11.5px] leading-snug text-faint">{description}</span>}
      </span>
    </label>
  );
}

/* ──────────────────────────────  Badges  ────────────────────────────── */

export type Tone = 'neutral' | 'ember' | 'verdigris' | 'ochre' | 'danger' | 'ink';

const tones: Record<Tone, string> = {
  neutral: 'border-line-strong bg-[color-mix(in_oklab,var(--c-ink)_6%,transparent)] text-muted',
  ember: 'border-ember/35 bg-ember/12 text-ember',
  verdigris: 'border-verdigris/35 bg-verdigris/12 text-verdigris',
  ochre: 'border-ochre/35 bg-ochre/12 text-ochre',
  danger: 'border-danger/35 bg-danger/12 text-danger',
  ink: 'border-ink/25 bg-ink/10 text-ink',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.08em]',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ──────────────────────────────  Avatar  ────────────────────────────── */

export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.34) }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-strong bg-raised font-mono uppercase text-muted',
        className,
      )}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials(name || 'L')}
    </span>
  );
}

/* ──────────────────────────────  Progress  ──────────────────────────── */

export function ProgressBar({
  value,
  className,
  tone = 'ember',
  showLabel,
  height = 6,
}: {
  value: number;
  className?: string;
  tone?: 'ember' | 'verdigris' | 'ochre';
  showLabel?: boolean;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  const bg = tone === 'verdigris' ? 'bg-verdigris' : tone === 'ochre' ? 'bg-ochre' : 'bg-ember';
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--c-ink)_10%,transparent)]" style={{ height }}>
        <div className={cn('h-full rounded-full transition-[width] duration-500', bg)} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="w-8 shrink-0 text-right font-mono text-[10px] text-muted">{pct}%</span>}
    </div>
  );
}

export function ProgressRing({
  value,
  size = 52,
  stroke = 4,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-line-strong" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (pct / 100) * circumference}
          className="text-ember transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-ink">{children ?? `${Math.round(pct)}%`}</span>
    </span>
  );
}

/* ──────────────────────────────  Modal  ─────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#05070A]/70 backdrop-blur-[3px] animate-fade" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ maxWidth: width }}
        className="relative z-10 w-full overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] animate-rise"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="font-display text-[19px] tracking-[-0.02em] text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-muted">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        {children && <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>}
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-[color-mix(in_oklab,var(--c-canvas)_60%,var(--c-surface))] px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ──────────────────────────────  Tabs  ──────────────────────────────── */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto border-b border-line', className)}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative shrink-0 px-3 py-2.5 text-[12.5px] font-medium transition-colors',
              active ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.count !== undefined && (
                <span className="rounded-full bg-[color-mix(in_oklab,var(--c-ink)_9%,transparent)] px-1.5 py-[1px] font-mono text-[9.5px] text-muted">
                  {tab.count}
                </span>
              )}
            </span>
            {active && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-ember" />}
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────  States  ────────────────────────────── */

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn('animate-spin text-muted', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-raised text-muted">
          {icon}
        </span>
      )}
      <div>
        <p className="font-display text-[16px] text-ink">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-md bg-[color-mix(in_oklab,var(--c-ink)_6%,transparent)]', className)} />;
}

export function Stat({
  label,
  value,
  hint,
  tone = 'ink',
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'ink' | 'ember' | 'verdigris' | 'ochre';
  icon?: ReactNode;
}) {
  const color =
    tone === 'ember' ? 'text-ember' : tone === 'verdigris' ? 'text-verdigris' : tone === 'ochre' ? 'text-ochre' : 'text-ink';
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="label-caps">{label}</span>
        {icon && <span className="text-faint">{icon}</span>}
      </div>
      <p className={cn('mt-2 font-display text-[26px] leading-none tracking-[-0.03em]', color)}>{value}</p>
      {hint && <p className="mt-1.5 text-[11px] text-faint">{hint}</p>}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <span className="font-mono text-[10.5px] text-faint">
        page {page} / {totalPages}
      </span>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        {eyebrow && <p className="label-caps mb-2">{eyebrow}</p>}
        <h2 className="text-[24px] leading-tight text-ink">{title}</h2>
        {description && <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
