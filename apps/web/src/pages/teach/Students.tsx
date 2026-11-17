import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Search, Users } from 'lucide-react';
import { useInstructorStudentsQuery } from '../../api';
import { Avatar, Badge, EmptyState, Input, ProgressBar, Skeleton, Stat } from '../../components/ui';
import { relativeDate } from '../../lib/format';

export default function TeachStudents() {
  const { data: students = [], isLoading } = useInstructorStudentsQuery();
  const [search, setSearch] = useState('');

  const filtered = students.filter((item) =>
    `${item.name} ${item.email} ${item.courseTitle}`.toLowerCase().includes(search.toLowerCase()),
  );
  const active = students.filter((item) => !item.completed).length;
  const completed = students.filter((item) => item.completed).length;
  const avgProgress = students.length
    ? Math.round(students.reduce((sum, item) => sum + item.progressPct, 0) / students.length)
    : 0;

  return (
    <div className="space-y-7">
      <div>
        <p className="label-caps mb-2">Audience</p>
        <h1 className="text-[clamp(1.8rem,3.4vw,2.5rem)] leading-none text-ink">Students.</h1>
        <p className="mt-3 text-[13px] text-muted">Learners enrolled across all of your courses, with their current progress.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Enrolments" value={students.length} tone="ember" icon={<Users size={14} />} />
        <Stat label="In progress" value={active} icon={<GraduationCap size={14} />} />
        <Stat label="Completed" value={completed} tone="verdigris" icon={<BookOpen size={14} />} />
      </div>

      {students.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="label-caps">Average completion</span>
            <span className="font-mono text-[11px] text-ink">{avgProgress}%</span>
          </div>
          <ProgressBar value={avgProgress} className="mt-2" height={6} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search learners or courses" className="pl-9" />
        </div>
        <span className="font-mono text-[10px] text-faint">{filtered.length} records</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={20} />}
          title={search ? 'No matching learners' : 'No students yet'}
          description={search ? 'Try a different name or course title.' : 'Publish a course and learners will appear here once they enrol.'}
          action={!search ? <Link to="/teach/courses"><span className="text-ember hover:underline font-mono text-[11px]">Manage courses →</span></Link> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="hidden grid-cols-[1.4fr_1.2fr_1fr_0.7fr] gap-4 border-b border-line bg-raised/40 px-4 py-2.5 md:grid">
            {['Learner', 'Course', 'Progress', 'Enrolled'].map((heading) => <span key={heading} className="label-caps">{heading}</span>)}
          </div>
          <div className="divide-y divide-line">
            {filtered.map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1.4fr_1.2fr_1fr_0.7fr] md:items-center md:gap-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={item.name} size={30} />
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] text-ink">{item.name}</p>
                    <p className="truncate text-[10.5px] text-faint">{item.email}</p>
                  </div>
                </div>
                <p className="truncate text-[12px] text-muted">{item.courseTitle}</p>
                <div className="flex items-center gap-2">
                  <ProgressBar value={item.progressPct} className="flex-1" height={5} tone={item.completed ? 'verdigris' : 'ember'} />
                  <span className="w-9 text-right font-mono text-[10px] text-muted">{item.progressPct}%</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-faint">{relativeDate(item.enrolledAt)}</span>
                  {item.completed && <Badge tone="verdigris">Done</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
