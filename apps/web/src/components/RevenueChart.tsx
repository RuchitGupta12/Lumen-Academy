import { useMemo, useState } from 'react';
import type { MonthlyRevenue } from '@lumen/shared';
import { compactMoney, money } from '../lib/format';

const W = 720;
const H = 240;
const PAD = { top: 18, right: 16, bottom: 30, left: 44 };

function monthLabel(month: string) {
  const [year, m] = month.split('-').map(Number);
  if (!year || !m) return month;
  return new Date(year, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

export function RevenueChart({ data, height = 240 }: { data: MonthlyRevenue[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    const points = data.length
      ? data
      : [{ month: new Date().toISOString().slice(0, 7), gross: 0, net: 0, fees: 0 }];
    const max = Math.max(1000, ...points.map((p) => p.gross));
    const step = max / 4;
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const x = (index: number) =>
      points.length === 1 ? PAD.left + innerW / 2 : PAD.left + (index / (points.length - 1)) * innerW;
    const y = (value: number) => PAD.top + innerH - (value / max) * innerH;

    const line = (key: 'gross' | 'net') =>
      points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

    const area = (key: 'gross' | 'net') =>
      `${line(key)} L${x(points.length - 1).toFixed(1)},${(H - PAD.bottom).toFixed(1)} L${x(0).toFixed(1)},${
        H - PAD.bottom
      } L${x(0).toFixed(1)},${y(points[0]![key]).toFixed(1)} Z`;

    return { points, max, step, x, y, line, area };
  }, [data]);

  const active = hover === null ? null : model.points[hover];

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height }}
        role="img"
        aria-label="Monthly revenue chart"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="grossFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6A3D" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#FF6A3D" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5FB3A1" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#5FB3A1" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grid */}
        {[0, 1, 2, 3, 4].map((index) => {
          const value = model.step * index;
          const y = model.y(value);
          return (
            <g key={index}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeWidth="1"
                className="text-line"
                strokeDasharray={index === 0 ? undefined : '3 5'}
              />
              <text x={PAD.left - 8} y={y + 3.5} textAnchor="end" className="fill-current font-mono text-[9px] text-faint">
                {compactMoney(value)}
              </text>
            </g>
          );
        })}

        {/* areas */}
        <path d={model.area('gross')} fill="url(#grossFill)" />
        <path d={model.area('net')} fill="url(#netFill)" />

        <path d={model.line('gross')} fill="none" stroke="#FF6A3D" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path
          d={model.line('net')}
          fill="none"
          stroke="#5FB3A1"
          strokeWidth="1.6"
          strokeDasharray="5 4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* points + hit areas */}
        {model.points.map((point, index) => {
          const x = model.x(index);
          return (
            <g key={point.month}>
              <text x={x} y={H - 10} textAnchor="middle" className="fill-current font-mono text-[9.5px] text-faint">
                {monthLabel(point.month)}
              </text>
              {hover === index && (
                <line x1={x} x2={x} y1={PAD.top} y2={H - PAD.bottom} stroke="currentColor" className="text-line-strong" strokeWidth="1" />
              )}
              <circle cx={x} cy={model.y(point.gross)} r={hover === index ? 4 : 2.6} fill="#FF6A3D" />
              <circle cx={x} cy={model.y(point.net)} r={hover === index ? 3.4 : 2.2} fill="#5FB3A1" />
              <rect
                x={x - (W - PAD.left - PAD.right) / Math.max(1, model.points.length) / 2}
                y={PAD.top}
                width={(W - PAD.left - PAD.right) / Math.max(1, model.points.length)}
                height={H - PAD.top - PAD.bottom}
                fill="transparent"
                onMouseEnter={() => setHover(index)}
              />
            </g>
          );
        })}
      </svg>

      {active && hover !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-[150px] -translate-x-1/2 rounded-lg border border-line-strong bg-surface/95 p-2.5 shadow-xl backdrop-blur"
          style={{ left: `${(model.x(hover) / W) * 100}%` }}
        >
          <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint">
            {new Date(`${active.month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <div className="mt-1.5 space-y-1">
            <Row color="#FF6A3D" label="Gross" value={money(active.gross)} />
            <Row color="#5FB3A1" label="Net payout" value={money(active.net)} />
            <Row color="#8B909C" label="Platform fee" value={money(active.fees)} />
          </div>
        </div>
      )}

      <div className="mt-1 flex items-center gap-4 pl-11 font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[2px] w-4 rounded bg-ember" /> Gross
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[2px] w-4 rounded bg-verdigris" /> Net payout
        </span>
      </div>
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="font-mono text-[10.5px] text-ink">{value}</span>
    </div>
  );
}
