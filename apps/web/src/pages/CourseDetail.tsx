import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  CirclePlay,
  Clock3,
  FileText,
  Globe2,
  HelpCircle,
  Lock,
  Radio,
  Star,
  Users,
} from 'lucide-react';
import type { LessonDTO, SectionDTO } from '@lumen/shared';
import { useAppSelector } from '../hooks';
import {
  errorMessage,
  useCheckoutMutation,
  useCourseQuery,
  useEnrollMutation,
  useLiveCourseQuery,
} from '../api';
import { CourseCover } from '../components/CourseCover';
import { Avatar, Badge, Button, EmptyState, ProgressBar, Skeleton } from '../components/ui';
import { useToast } from '../components/Toast';
import { cn, dateTime, levelLabel, longDuration, money } from '../lib/format';

const lessonIcon = (type: string) => {
  if (type === 'quiz') return <HelpCircle size={13} className="text-ochre" />;
  if (type === 'text') return <FileText size={13} className="text-verdigris" />;
  if (type === 'live') return <Radio size={13} className="text-ember" />;
  return <CirclePlay size={13} className="text-muted" />;
};

function Prose({ text }: { text: string }) {
  const blocks = useMemo(() => text.split(/\n{2,}/).filter(Boolean), [text]);
  return (
    <div className="prose-lumen">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (trimmed.startsWith('## ')) return <h2 key={index}>{trimmed.slice(3)}</h2>;
        if (trimmed.startsWith('> ')) return <blockquote key={index}>{trimmed.slice(2)}</blockquote>;
        if (/^\d+\.\s/m.test(trimmed)) {
          const items = trimmed.split('\n').filter(Boolean);
          return (
            <ol key={index} className="list-decimal">
              {items.map((item, itemIndex) => (
                <li key={itemIndex}>{item.replace(/^\d+\.\s*/, '')}</li>
              ))}
            </ol>
          );
        }
        if (trimmed.startsWith('- ')) {
          const items = trimmed.split('\n').filter(Boolean);
          return (
            <ul key={index} className="list-disc">
              {items.map((item, itemIndex) => (
                <li key={itemIndex}>{item.replace(/^-\s*/, '')}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{trimmed}</p>;
      })}
    </div>
  );
}

export default function CourseDetail() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAppSelector((state) => state.auth);

  const { data: course, isLoading, error } = useCourseQuery(slug);
  const { data: liveSessions } = useLiveCourseQuery(course?.id ?? '', { skip: !course?.id });
  const [enroll, { isLoading: enrolling }] = useEnrollMutation();
  const [checkout, { isLoading: checkingOut }] = useCheckoutMutation();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [buying, setBuying] = useState(false);

  const allLessons = useMemo(() => (course?.lessons ?? []).slice().sort((a, b) => a.order - b.order), [course]);
  const firstLesson = allLessons[0];
  const totalLessons = course?.stats.lessonCount ?? allLessons.length;
  const freePreviewCount = allLessons.filter((lesson) => lesson.isPreview).length;
  const isOwner = Boolean(user && course && ((user.role === 'instructor' && course.instructor.id === user.id) || user.role === 'admin'));

  const startLearning = async () => {
    if (!course) return;
    const target = firstLesson ? `/app/courses/${course.slug}/${firstLesson.id}` : `/app/courses/${course.slug}`;
    if (course.isEnrolled || isOwner) {
      navigate(target);
      return;
    }
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`);
      return;
    }
    if (course.price === 0) {
      try {
        await enroll({ courseId: course.id }).unwrap();
        toast.success('You are enrolled', 'Your progress starts at lesson one.');
        navigate(target);
      } catch (err) {
        toast.error('Could not enrol', errorMessage(err));
      }
      return;
    }

    setBuying(true);
    try {
      const result = await checkout({ courseId: course.id }).unwrap();
      if (result.mode === 'free' || result.enrolled) {
        navigate(target);
      } else if (result.mode === 'stripe' && result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      } else if (result.checkoutUrl) {
        navigate(result.checkoutUrl);
      }
    } catch (err) {
      toast.error('Checkout failed to start', errorMessage(err));
    } finally {
      setBuying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1180px] space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="h-[280px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
        <EmptyState
          title="We couldn't find that course"
          description="It may have been unpublished, or the link is wrong."
          action={
            <Link to="/courses">
              <Button variant="secondary">Back to the catalog</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const grouped = course.sections.map((section: SectionDTO) => ({
    section,
    lessons: allLessons.filter((lesson: LessonDTO) => lesson.sectionId === section.id),
  }));

  const ctaLabel = course.isEnrolled || isOwner
    ? 'Continue learning'
    : course.price === 0
      ? 'Enrol for free'
      : `Buy for ${money(course.price)}`;
  const busy = enrolling || checkingOut || buying;

  return (
    <div>
      {/* header */}
      <div className="border-b border-line bg-[color-mix(in_oklab,var(--c-surface)_40%,var(--c-canvas))]">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-9 sm:px-6 lg:grid-cols-[1.55fr_0.95fr]">
          <div>
            <nav className="mb-4 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              <Link to="/courses" className="hover:text-muted">
                Catalog
              </Link>
              <span>/</span>
              <span className="text-muted">{course.category}</span>
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="ember">{levelLabel[course.level] ?? course.level}</Badge>
              {course.status !== 'published' && <Badge tone="ochre">{course.status.replace('_', ' ')}</Badge>}
              {freePreviewCount > 0 && <Badge tone="verdigris">{freePreviewCount} free preview</Badge>}
            </div>

            <h1 className="mt-4 max-w-2xl text-[clamp(1.9rem,4vw,3rem)] leading-[1.04] text-ink">{course.title}</h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">{course.subtitle}</p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Star size={12} className="fill-ochre text-ochre" />
                <strong className="font-medium text-ink">{course.stats.ratingAvg.toFixed(1)}</strong>
                <span className="text-faint">({course.stats.ratingCount} ratings)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users size={12} /> {course.stats.enrollmentCount} learners
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={12} /> {longDuration(course.stats.durationSec)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Globe2 size={12} /> English · self-paced
              </span>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Avatar name={course.instructor.name} src={course.instructor.avatarUrl} size={34} />
              <div className="leading-tight">
                <p className="text-[12.5px] text-ink">{course.instructor.name}</p>
                <p className="text-[11px] text-faint">{course.instructor.headline ?? 'Lumen instructor'}</p>
              </div>
            </div>
          </div>

          {/* purchase card */}
          <div className="lg:-mb-16">
            <div className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[0_30px_70px_-35px_rgba(0,0,0,0.85)]">
              <CourseCover cover={course.cover} category={course.category} className="aspect-[16/10] rounded-none" />
              <div className="space-y-4 p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="label-caps">Lifetime access</p>
                    <p className="mt-1 font-display text-[28px] leading-none text-ink">
                      {course.price === 0 ? 'Free' : money(course.price)}
                    </p>
                  </div>
                  {course.isEnrolled ? <Badge tone="verdigris" dot>Enrolled</Badge> : <Badge tone="neutral">One-time</Badge>}
                </div>

                <Button variant="primary" size="lg" block loading={busy} onClick={() => void startLearning()} iconRight={<ArrowRight size={15} />}>
                  {ctaLabel}
                </Button>

                <ul className="space-y-2 border-t border-line pt-3">
                  {[
                    `${totalLessons} lessons · ${longDuration(course.stats.durationSec)} of video`,
                    'Graded quiz with instant feedback',
                    'Live critique room access',
                    'Verifiable certificate on completion',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[11.5px] text-muted">
                      <BadgeCheck size={13} className="mt-[1px] shrink-0 text-verdigris" />
                      {item}
                    </li>
                  ))}
                </ul>

                <p className="border-t border-line pt-3 font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
                  Test-mode checkout · 20% platform fee on instructor payouts
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.55fr_0.95fr]">
        <div className="space-y-9">
          {/* outcomes */}
          <section>
            <h2 className="mb-3 text-[20px] text-ink">What this course changes</h2>
            <Prose text={course.description} />
          </section>

          {/* curriculum */}
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[20px] text-ink">Curriculum</h2>
                <p className="mt-1 text-[12px] text-muted">
                  {course.sections.length} sections · {totalLessons} lessons · {longDuration(course.stats.durationSec)}
                </p>
              </div>
            </div>

            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {grouped.map(({ section, lessons }) => {
                const open = openSections[section.id] ?? true;
                const sectionDuration = lessons.reduce((sum, lesson) => sum + (lesson.durationSec ?? 0), 0);
                return (
                  <div key={section.id}>
                    <button
                      onClick={() => setOpenSections((current) => ({ ...current, [section.id]: !open }))}
                      className="flex w-full items-center justify-between gap-3 bg-[color-mix(in_oklab,var(--c-surface)_60%,var(--c-canvas))] px-4 py-3 text-left"
                    >
                      <div>
                        <p className="text-[13px] font-medium text-ink">{section.title}</p>
                        <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
                          {lessons.length} lessons · {longDuration(sectionDuration)}
                        </p>
                      </div>
                      <ChevronDown size={15} className={cn('text-faint transition-transform', open && 'rotate-180')} />
                    </button>
                    {open && (
                      <ul className="divide-y divide-line bg-surface">
                        {lessons.map((lesson, index) => {
                          const canOpen = course.isEnrolled || lesson.isPreview || isOwner;
                          const content = (
                            <>
                              <span className="w-5 shrink-0 text-right font-mono text-[10px] text-faint">{index + 1}</span>
                              {lessonIcon(lesson.type)}
                              <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">{lesson.title}</span>
                              {lesson.isPreview && !course.isEnrolled && <Badge tone="verdigris">Preview</Badge>}
                              {!canOpen && <Lock size={11} className="text-faint" />}
                              {lesson.durationSec > 0 && (
                                <span className="font-mono text-[10px] text-faint">
                                  {Math.round(lesson.durationSec / 60)}m
                                </span>
                              )}
                            </>
                          );
                          return (
                            <li key={lesson.id}>
                              {canOpen ? (
                                <Link
                                  to={`/app/courses/${course.slug}/${lesson.id}`}
                                  className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-raised/60"
                                >
                                  {content}
                                </Link>
                              ) : (
                                <div className="flex items-center gap-2.5 px-4 py-2.5 opacity-70">{content}</div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* live */}
          {liveSessions && liveSessions.length > 0 && (
            <section>
              <h2 className="mb-3 text-[20px] text-ink">Live critique rooms</h2>
              <div className="space-y-2">
                {liveSessions.map((session) => (
                  <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3.5">
                    <div>
                      <p className="text-[13px] text-ink">{session.title}</p>
                      <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
                        {dateTime(session.scheduledAt)} · {session.instructorName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={session.status === 'live' ? 'ember' : 'neutral'} dot={session.status === 'live'}>
                        {session.status}
                      </Badge>
                      {(session.isEnrolled || session.isHost) && (
                        <Link to={`/live/${session.id}`}>
                          <Button size="sm" variant="outline" icon={<Radio size={12} />}>
                            Enter room
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* side */}
        <aside className="space-y-5">
          <div className="card p-4">
            <p className="label-caps mb-3">Instructor</p>
            <div className="flex items-center gap-3">
              <Avatar name={course.instructor.name} src={course.instructor.avatarUrl} size={42} />
              <div>
                <p className="text-[13px] text-ink">{course.instructor.name}</p>
                <p className="text-[11px] text-faint">{course.instructor.headline ?? 'Lumen faculty'}</p>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Teaches from current work, not from a slide deck written five years ago. Reviews learner projects in
              live rooms and annotates the recordings.
            </p>
          </div>

          <div className="card p-4">
            <p className="label-caps mb-3">Course record</p>
            <dl className="space-y-2 text-[12px]">
              {[
                ['Lessons', String(totalLessons)],
                ['Sections', String(course.sections.length)],
                ['Video', longDuration(course.stats.durationSec)],
                ['Level', levelLabel[course.level] ?? course.level],
                ['Learners', String(course.stats.enrollmentCount)],
                ['Updated', new Date(course.updatedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b border-line pb-1.5 last:border-0">
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-mono text-[11px] text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {course.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {course.tags.map((tag) => (
                <Link key={tag} to={`/courses?q=${encodeURIComponent(tag)}`}>
                  <Badge tone="neutral">#{tag}</Badge>
                </Link>
              ))}
            </div>
          )}

          {course.isEnrolled && (
            <div className="card p-4">
              <p className="label-caps mb-2">Your progress</p>
              <ProgressBar value={0} showLabel />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
