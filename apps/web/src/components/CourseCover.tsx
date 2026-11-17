import type { CourseDTO } from '@lumen/shared';
import { cn } from '../lib/format';

export type Cover = CourseDTO['cover'];

/**
 * Procedural course cover — no stock photography. A gradient field, a fine
 * engraved grid and one oversized typographic motif, all derived from the
 * course record so every card is deterministic and distinct.
 */
export function CourseCover({
  cover,
  category,
  level,
  title,
  className,
  variant = 'card',
}: {
  cover: Cover;
  category?: string;
  level?: string;
  title?: string;
  className?: string;
  variant?: 'card' | 'hero' | 'thumb' | 'banner';
}) {
  const { from, to, motif } = cover ?? { from: '#1B2029', to: '#0B0D11', motif: 'L' };

  return (
    <div
      className={cn('relative isolate overflow-hidden', variant === 'thumb' ? 'rounded-lg' : 'rounded-xl', className)}
      style={{ background: `linear-gradient(142deg, ${from} 0%, ${to} 78%)` }}
    >
      {/* light field */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 18% 8%, rgba(255,255,255,0.16), transparent 55%), radial-gradient(80% 80% at 88% 96%, rgba(0,0,0,0.55), transparent 60%)',
        }}
      />
      {/* engraved grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.35) 1px, transparent 1px)',
          backgroundSize: variant === 'hero' ? '56px 56px' : '28px 28px',
          maskImage: 'radial-gradient(90% 90% at 30% 20%, black, transparent 85%)',
        }}
      />
      {/* concentric arcs */}
      <svg
        viewBox="0 0 200 200"
        aria-hidden
        className="absolute -right-[18%] top-1/2 h-[190%] w-[190%] -translate-y-1/2 opacity-30"
        preserveAspectRatio="xMidYMid meet"
      >
        {[34, 52, 70, 88].map((r) => (
          <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="0.5" />
        ))}
        <line x1="100" y1="4" x2="100" y2="196" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
        <line x1="4" y1="100" x2="196" y2="100" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
      </svg>

      {/* motif */}
      <div
        aria-hidden
        className={cn(
          'absolute select-none font-display leading-none text-white/25',
          variant === 'hero' ? '-bottom-[12%] right-4 text-[220px]' : '-bottom-[16%] right-2 text-[110px]',
          variant === 'banner' && '-bottom-[40%] right-6 text-[180px]',
          variant === 'thumb' && '-bottom-[18%] right-1 text-[46px]',
        )}
        style={{ fontVariationSettings: "'SOFT' 30, 'WONK' 1, 'opsz' 100" }}
      >
        {motif || 'L'}
      </div>

      {/* corner ticks */}
      <div className="pointer-events-none absolute inset-0">
        <span className="absolute left-3 top-3 h-3 w-3 border-l border-t border-white/45" />
        <span className="absolute right-3 top-3 h-3 w-3 border-r border-t border-white/45" />
        <span className="absolute bottom-3 left-3 h-3 w-3 border-b border-l border-white/45" />
        <span className="absolute bottom-3 right-3 h-3 w-3 border-b border-r border-white/45" />
      </div>

      {(category || level) && variant !== 'thumb' && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3.5">
          {category && (
            <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-white/70">{category}</span>
          )}
          {level && (
            <span className="rounded-full border border-white/25 px-2 py-[2px] font-mono text-[9px] uppercase tracking-[0.12em] text-white/80">
              {level}
            </span>
          )}
        </div>
      )}

      {variant === 'banner' && title && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-16">
          <p className="max-w-lg font-display text-[22px] leading-tight text-white/95">{title}</p>
        </div>
      )}
    </div>
  );
}
