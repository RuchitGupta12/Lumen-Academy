import { useState } from 'react';
import { Banknote, Download, Info, Percent, Wallet } from 'lucide-react';
import { useInstructorOverviewQuery, useInstructorPayoutsQuery, useInstructorRevenueQuery } from '../../api';
import { RevenueChart } from '../../components/RevenueChart';
import { Badge, Button, EmptyState, Skeleton, Stat } from '../../components/ui';
import { money } from '../../lib/format';

export default function TeachPayouts() {
  const [months, setMonths] = useState(6);
  const { data: totals } = useInstructorOverviewQuery({ range: String(months) });
  const { data: payouts = [], isLoading } = useInstructorPayoutsQuery();
  const { data: revenue = [] } = useInstructorRevenueQuery(months);

  const gross = totals?.totals.gross ?? payouts.reduce((sum, row) => sum + row.gross, 0);
  const fees = totals?.totals.fees ?? payouts.reduce((sum, row) => sum + row.fee, 0);
  const net = totals?.totals.net ?? payouts.reduce((sum, row) => sum + row.net, 0);

  const exportCsv = () => {
    const header = 'month,gross_cents,fee_cents,net_cents,orders';
    const rows = payouts.map((row) => `${row.month},${row.gross},${row.fee},${row.net},${row.orders}`);
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lumen-payouts.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>;
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps mb-2">Business</p>
          <h1 className="text-[clamp(1.8rem,3.4vw,2.5rem)] leading-none text-ink">Revenue &amp; payouts.</h1>
          <p className="mt-3 text-[13px] text-muted">Gross sales, platform fees and your net earnings — all from paid orders.</p>
        </div>
        <Button variant="outline" icon={<Download size={14} />} onClick={exportCsv}>Export CSV</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Gross sales" value={money(gross)} icon={<Banknote size={14} />} />
        <Stat label="Platform fees" value={money(fees)} tone="ochre" icon={<Percent size={14} />} />
        <Stat label="Net payout" value={money(net)} tone="verdigris" icon={<Wallet size={14} />} />
      </div>

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label-caps mb-1">Payout history</p>
            <h2 className="text-[18px] text-ink">Monthly breakdown</h2>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-raised p-0.5">
            {[3, 6, 12].map((value) => (
              <button
                key={value}
                onClick={() => setMonths(value)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors ${months === value ? 'bg-[color-mix(in_oklab,var(--c-ember)_18%,transparent)] text-ember' : 'text-muted hover:text-ink'}`}
              >
                {value}M
              </button>
            ))}
          </div>
        </div>
        <RevenueChart data={revenue} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[17px] text-ink">Statement</h2>
          <Badge tone="neutral">20% platform fee</Badge>
        </div>
        {payouts.length === 0 ? (
          <EmptyState title="No payouts yet" description="Paid orders will appear here as monthly rows." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-line font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
                  <th className="px-5 py-2.5">Month</th>
                  <th className="px-5 py-2.5 text-right">Orders</th>
                  <th className="px-5 py-2.5 text-right">Gross</th>
                  <th className="px-5 py-2.5 text-right">Fee (20%)</th>
                  <th className="px-5 py-2.5 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payouts.map((row) => (
                  <tr key={row.month} className="hover:bg-raised/40">
                    <td className="px-5 py-3 font-mono text-[11px] text-ink">{row.month}</td>
                    <td className="px-5 py-3 text-right font-mono text-[11px] text-muted">{row.orders}</td>
                    <td className="px-5 py-3 text-right font-mono text-[11px] text-ink">{money(row.gross)}</td>
                    <td className="px-5 py-3 text-right font-mono text-[11px] text-ochre">−{money(row.fee)}</td>
                    <td className="px-5 py-3 text-right font-mono text-[11px] text-verdigris">{money(row.net)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-raised/30 font-medium">
                  <td className="px-5 py-3 text-ink">Total</td>
                  <td className="px-5 py-3 text-right font-mono text-[11px] text-muted">{payouts.reduce((s, r) => s + r.orders, 0)}</td>
                  <td className="px-5 py-3 text-right font-mono text-[11px] text-ink">{money(gross)}</td>
                  <td className="px-5 py-3 text-right font-mono text-[11px] text-ochre">−{money(fees)}</td>
                  <td className="px-5 py-3 text-right font-mono text-[11px] text-verdigris">{money(net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-line bg-[color-mix(in_oklab,var(--c-surface)_55%,var(--c-canvas))] p-4">
        <Info size={16} className="mt-0.5 shrink-0 text-muted" />
        <p className="text-[11.5px] leading-relaxed text-muted">
          Payouts are calculated from fulfilled orders, less the platform fee. Payments run in test mode in this build —
          no real money moves. Refunds are reversed out of gross revenue.
        </p>
      </div>
    </div>
  );
}

