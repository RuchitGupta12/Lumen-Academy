import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, DollarSign, Plus, Star, Users } from 'lucide-react';
import { useInstructorOverviewQuery } from '../../api';
import { RevenueChart } from '../../components/RevenueChart';
import { Badge, Button, EmptyState, SectionHeading, Skeleton, Stat } from '../../components/ui';
import { compactMoney, money, relativeDate, statusTone } from '../../lib/format';

export default function TeachOverview() {
  const [range, setRange] = useState('6');
  const { data, isLoading } = useInstructorOverviewQuery({ range });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-32 rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-4"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (!data) return <EmptyState title="No data yet" description="Your instructor metrics will appear here." />;

  const { totals } = data;

  return (
    <div className="space-y-7">
      <SectionHeading
        eyebrow="Instructor studio"
        title="Your teaching at a glance."
        description="Revenue, students and course performance in one place."
        action={
          <Link to="/teach/courses">
            <Button variant="primary" icon={<Plus size={15} />}>Manage courses</Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Net earnings" value={compactMoney(totals.net)} tone="verdigris" hint={`${money(totals.gross)} gross`} icon={<DollarSign size={14} />} />
        <Stat label="Students" value={totals.students} tone="ember" icon={<Users size={14} />} />
        <Stat label="Courses" value={totals.courses} icon={<BookOpen size={14} />} />
        <Stat label="Rating" value={totals.ratingAvg ? totals.ratingAvg.toFixed(1) : '—'} tone="ochre" hint={`${totals.ratingCount} ratings`} icon={<Star size={14} />} />
      </div>

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label-caps mb-1">Earnings over time</p>
            <h2 className="text-[18px] text-ink">Revenue</h2>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-raised p-0.5">
            {[
              { value: '3', label: '3M' },
              { value: '6', label: '6M' },
              { value: '12', label: '12M' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setRange(option.value)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors ${range === option.value ? 'bg-[color-mix(in_oklab,var(--c-ember)_18%,transparent)] text-ember' : 'text-muted hover:text-ink'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <RevenueChart data={data.monthly} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* top courses */}
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[17px] text-ink">Top courses</h2>
            <Link to="/teach/courses" className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted hover:text-ember">View all</Link>
          </div>
          {data.topCourses.length === 0 ? (
            <p className="px-5 py-10 text-center text-[12px] text-faint">No courses yet.</p>
          ) : (
            <div className="divide-y divide-line">
              {data.topCourses.slice(0, 5).map((course, index) => (
                <Link key={course.id} to={`/teach/courses/${course.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-raised/60">
                  <span className="w-4 font-mono text-[10px] text-faint">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] text-ink">{course.title}</p>
                    <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">{course.students} students · {course.ratingAvg.toFixed(1)}★</p>
                  </div>
                  <span className="font-mono text-[11px] text-verdigris">{compactMoney(course.revenue)}</span>
                  <Badge tone={statusTone[course.status] ?? 'neutral'}>{course.status.replace('_', ' ')}</Badge>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* recent orders */}
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[17px] text-ink">Recent sales</h2>
            <Link to="/teach/payouts" className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted hover:text-ember">Payouts</Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="px-5 py-10 text-center text-[12px] text-faint">No sales yet.</p>
          ) : (
            <div className="divide-y divide-line">
              {data.recentOrders.slice(0, 6).map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] text-ink">{order.courseTitle}</p>
                    <p className="mt-0.5 font-mono text-[9.5px] text-faint">{relativeDate(order.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[11.5px] text-ink">{money(order.amount)}</p>
                    <p className={`font-mono text-[9px] uppercase ${order.status === 'paid' ? 'text-verdigris' : 'text-ochre'}`}>{order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Link to="/teach/courses" className="card hover-lift flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-[14px] text-ink">Ready to publish something new?</p>
          <p className="mt-1 text-[12px] text-muted">Build a course, add lessons and upload a video through the authoring pipeline.</p>
        </div>
        <ArrowRight size={18} className="text-ember" />
      </Link>
    </div>
  );
}
