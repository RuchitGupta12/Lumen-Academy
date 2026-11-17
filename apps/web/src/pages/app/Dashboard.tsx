import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  Clock3,
  Flame,
  PlayCircle,
  Radio,
  Sparkles,
} from 'lucide-react';
import { useAppSelector } from '../../hooks';
import {
  useCoursesQuery,
  useLiveUpcomingQuery,
  useMeQuery,
  useMyEnrollmentsQuery,
} from '../../api';
import { CourseCover } from '../../components/CourseCover';
import { Badge, Button, EmptyState, ProgressBar, Skeleton, Stat } from '../../components/ui';
import { dateTime, longDuration, statusTone } from '../../lib/format';

export default function Dashboard() {
  const { user } = useAppSelector((state) => state.auth);
  const { data: me } = useMeQuery();
  const { data: enrollments = [], isLoading } = useMyEnrollmentsQuery();
  const { data: live = [] } = useLiveUpcomingQuery();
  const { data: recommended } = useCoursesQuery({ pageSize: '3', sort: 'popular' });

  const inProgress = enrollments.filter((item) => item.progressPct < 100);
  const completed = enrollments.filter((item) => item.progressPct >= 100);
  const certificates = enrollments.filter((item) => item.certificateSerial).length;
  const totalSeconds = enrollments.reduce(
    (sum, item) => sum + Math.round(((item.course?.stats.durationSec ?? 0) * item.progressPct) / 100),
    0,
  );
  const firstName = (me?.name ?? user?.name ?? 'there').split(' ')[0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8">
      {/* header */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-[color-mix(in_oklab,var(--c-surface)_65%,var(--c-canvas))] p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(60% 120% at 88% 10%, rgba(255,106,61,0.16), transparent 62%)' }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="label-caps mb-3 flex items-center gap-1.5"><Sparkles size={12} className="text-ember" /> Your workspace</p>
            <h1 className="text-[clamp(1.7rem,3.6vw,2.5rem)] leading-none text-ink">
              {greeting}, <span className="italic text-ember">{firstName}</span>.
            </h1>
            <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-muted">
              {inProgress.length > 0
                ? `You have ${inProgress.length} course${inProgress.length > 1 ? 's' : ''} in progress. Pick up where you left off — momentum compounds.`
                : 'Your learning journey starts here. Explore the catalog and find something worth building.'}
            </p>
          </div>
          <Link to="/courses">
            <Button variant="primary" iconRight={<ArrowRight size={15} />}>Explore courses</Button>
          </Link>
        </div>

        <div className="relative mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="In progress" value={inProgress.length} tone="ember" icon={<BookOpen size={14} />} />
          <Stat label="Completed" value={completed.length} tone="verdigris" icon={<Flame size={14} />} />
          <Stat label="Certificates" value={certificates} tone="ochre" icon={<Award size={14} />} />
          <Stat label="Time invested" value={longDuration(totalSeconds)} icon={<Clock3 size={14} />} />
        </div>
      </div>

      {/* continue learning */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="label-caps mb-1.5">Keep going</p>
            <h2 className="text-[22px] text-ink">Continue learning</h2>
          </div>
          {enrollments.length > 0 && (
            <Link to="/courses" className="hidden sm:block">
              <Button variant="ghost" size="sm" iconRight={<ArrowRight size={13} />}>All courses</Button>
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : inProgress.length === 0 ? (
          <EmptyState
            icon={<PlayCircle size={20} />}
            title="Nothing in progress yet"
            description="Enrol in a course and it will show up here with your progress and a resume button."
            action={<Link to="/courses"><Button size="sm" variant="secondary">Find a course</Button></Link>}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {inProgress.slice(0, 4).map((item) => {
              const course = item.course;
              if (!course) return null;
              const target = item.lastLessonId
                ? `/app/courses/${course.slug}/${item.lastLessonId}`
                : `/app/courses/${course.slug}`;
              return (
                <Link
                  key={item.id}
                  to={target}
                  className="card hover-lift group flex gap-4 overflow-hidden p-3.5"
                >
                  <CourseCover cover={course.cover} className="h-[92px] w-[130px] shrink-0" variant="thumb" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-[13.5px] font-medium text-ink group-hover:text-ember">{course.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-faint">{course.instructor.name}</p>
                    <div className="mt-auto space-y-2 pt-2">
                      <ProgressBar value={item.progressPct} showLabel />
                      <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">
                        <span>{course.stats.lessonCount} lessons</span>
                        <span className="flex items-center gap-1 text-ember opacity-0 transition-opacity group-hover:opacity-100">
                          Resume <ArrowRight size={11} />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        {/* recommended */}
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="label-caps mb-1.5">Curated for you</p>
              <h2 className="text-[22px] text-ink">Worth a look</h2>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(recommended?.items ?? []).map((course) => (
              <Link key={course.id} to={`/courses/${course.slug}`} className="card hover-lift group overflow-hidden">
                <CourseCover cover={course.cover} category={course.category} className="aspect-[16/9] rounded-none" />
                <div className="p-3">
                  <p className="line-clamp-2 text-[12.5px] leading-snug text-ink group-hover:text-ember">{course.title}</p>
                  <p className="mt-1.5 font-mono text-[10px] text-faint">{course.stats.lessonCount} lessons</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* live + certificates */}
        <section className="space-y-4">
          <div>
            <p className="label-caps mb-2.5">Live schedule</p>
            <div className="card divide-y divide-line overflow-hidden">
              {live.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <Radio size={18} className="text-faint" />
                  <p className="text-[12px] text-muted">No rooms scheduled</p>
                </div>
              ) : (
                live.slice(0, 4).map((session) => (
                  <Link key={session.id} to={`/live/${session.id}`} className="flex items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-raised/60">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] text-ink">{session.title}</p>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-faint">{dateTime(session.scheduledAt)}</p>
                    </div>
                    <Badge tone={statusTone[session.status] ?? 'neutral'} dot={session.status === 'live'}>{session.status}</Badge>
                  </Link>
                ))
              )}
            </div>
          </div>

          {certificates > 0 && (
            <Link to="/app/certificates" className="card hover-lift flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-ochre/35 bg-ochre/10 text-ochre">
                <Award size={18} />
              </span>
              <div>
                <p className="text-[13px] text-ink">{certificates} certificate{certificates > 1 ? 's' : ''} earned</p>
                <p className="text-[11px] text-faint">View and download your credentials</p>
              </div>
              <ArrowRight size={15} className="ml-auto text-faint" />
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
