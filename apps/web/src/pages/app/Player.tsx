import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CirclePlay,
  Clock3,
  FileText,
  HelpCircle,
  Lock,
  Radio,
  Trophy,
} from 'lucide-react';
import type { LessonDTO } from '@lumen/shared';
import {
  useCourseProgressQuery,
  useCourseQuery,
  usePlaybackQuery,
  useSaveProgressMutation,
} from '../../api';
import { VideoPlayer } from '../../components/VideoPlayer';
import { Badge, Button, EmptyState, ProgressBar, Skeleton, Spinner } from '../../components/ui';
import { cn, duration, longDuration } from '../../lib/format';
import { useToast } from '../../components/Toast';

function Prose({ text }: { text: string }) {
  const blocks = useMemo(() => text.split(/\n{2,}/).filter(Boolean), [text]);
  return (
    <div className="prose-lumen">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (trimmed.startsWith('## ')) return <h2 key={index}>{trimmed.slice(3)}</h2>;
        if (trimmed.startsWith('> ')) return <blockquote key={index}>{trimmed.slice(2)}</blockquote>;
        if (/^\d+\.\s/m.test(trimmed)) {
          return (
            <ol key={index} className="list-decimal">
              {trimmed.split('\n').filter(Boolean).map((item, i) => <li key={i}>{item.replace(/^\d+\.\s*/, '')}</li>)}
            </ol>
          );
        }
        if (trimmed.startsWith('- ')) {
          return (
            <ul key={index} className="list-disc">
              {trimmed.split('\n').filter(Boolean).map((item, i) => <li key={i}>{item.replace(/^-\s*/, '')}</li>)}
            </ul>
          );
        }
        return <p key={index}>{trimmed}</p>;
      })}
    </div>
  );
}

function lessonIcon(lesson: LessonDTO) {
  if (lesson.type === 'quiz') return <HelpCircle size={14} className="text-ochre" />;
  if (lesson.type === 'text') return <FileText size={14} className="text-verdigris" />;
  if (lesson.type === 'live') return <Radio size={14} className="text-ember" />;
  return <CirclePlay size={14} className="text-muted" />;
}

export default function Player() {
  const { slug = '', lessonId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: course, isLoading: courseLoading } = useCourseQuery(slug);
  const selectedId = lessonId ?? course?.lessons?.[0]?.id;
  const { data: playback, isLoading: playbackLoading } = usePlaybackQuery(selectedId ?? '', {
    skip: !selectedId,
  });
  const { data: progress } = useCourseProgressQuery(course?.id ?? '', { skip: !course?.id });
  const [saveProgress, { isLoading: saving }] = useSaveProgressMutation();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const lessons = useMemo(
    () => (course?.lessons ?? []).slice().sort((a, b) => a.order - b.order),
    [course],
  );
  const currentIndex = lessons.findIndex((lesson) => lesson.id === selectedId);
  const current = lessons[currentIndex];
  const prev = lessons[currentIndex - 1];
  const next = lessons[currentIndex + 1];

  const completedIds = useMemo(
    () => new Set((progress?.lessons ?? []).filter((item) => item.completed).map((item) => item.lessonId)),
    [progress],
  );

  useEffect(() => {
    if (current) {
      const sectionId = current.sectionId;
      setOpenSections((state) => (sectionId in state ? state : { ...state, [sectionId]: true }));
    }
  }, [current?.id, current?.sectionId]);

  const goTo = (id: string) => {
    navigate(`/app/courses/${slug}/${id}`);
    setSidebarOpen(false);
  };

  const markComplete = async () => {
    if (!current) return;
    try {
      await saveProgress({ lessonId: current.id, watchedSeconds: current.durationSec || 1, completed: true }).unwrap();
      toast.success('Lesson complete');
      if (next) goTo(next.id);
    } catch {
      toast.error('Could not save progress');
    }
  };

  if (courseLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  if (!course) {
    return (
      <EmptyState
        title="Course unavailable"
        description="This course may have been unpublished or the link is incorrect."
        action={<Link to="/app"><Button variant="secondary">Back to dashboard</Button></Link>}
      />
    );
  }

  if (lessons.length === 0) {
    return (
      <EmptyState
        title="No lessons yet"
        description="The instructor has not published any lessons for this course."
        action={<Link to="/app"><Button variant="secondary">Back to dashboard</Button></Link>}
      />
    );
  }

  const grouped = course.sections.map((section) => ({
    section,
    lessons: lessons.filter((lesson) => lesson.sectionId === section.id),
  }));

  const isVideo = current?.type === 'video';
  const readyVideo = isVideo && playback?.hlsUrl && (!playback.status || playback.status === 'ready');

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-4">
        <Link to={`/courses/${course.slug}`} className="text-[13px] font-medium leading-snug text-ink hover:text-ember">
          {course.title}
        </Link>
        <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-faint">
          <span>{progress?.completedLessons ?? 0} / {progress?.totalLessons ?? lessons.length} lessons</span>
          <span>{Math.round(progress?.progressPct ?? 0)}%</span>
        </div>
        <ProgressBar value={progress?.progressPct ?? 0} className="mt-2" height={5} />
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {grouped.map(({ section, lessons: sectionLessons }) => (
          <div key={section.id} className="mb-1">
            <button
              onClick={() => setOpenSections((state) => ({ ...state, [section.id]: !state[section.id] }))}
              className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left"
            >
              <span className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted">{section.title}</span>
              <ChevronDown size={13} className={cn('text-faint transition-transform', openSections[section.id] && 'rotate-180')} />
            </button>
            {openSections[section.id] && (
              <ul className="space-y-0.5 px-2 pb-2">
                {sectionLessons.map((lesson) => {
                  const done = completedIds.has(lesson.id);
                  const active = lesson.id === selectedId;
                  return (
                    <li key={lesson.id}>
                      <button
                        onClick={() => goTo(lesson.id)}
                        className={cn(
                          'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                          active ? 'bg-ember/10 text-ink' : 'text-muted hover:bg-raised/70 hover:text-ink',
                        )}
                      >
                        <span className={cn('mt-[2px]', done ? 'text-verdigris' : active ? 'text-ember' : 'text-faint')}>
                          {done ? <CheckCircle2 size={15} /> : lessonIcon(lesson)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] leading-snug">{lesson.title}</span>
                          <span className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-faint">
                            {lesson.type === 'video' && <><Clock3 size={9} /> {duration(lesson.durationSec)}</>}
                            {lesson.type === 'quiz' && 'Quiz'}
                            {lesson.type === 'text' && 'Reading'}
                            {lesson.type === 'live' && 'Live session'}
                          </span>
                        </span>
                        {active && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>

      {progress?.certificateSerial && (
        <div className="border-t border-line p-3">
          <Link to="/app/certificates" className="flex items-center gap-2.5 rounded-lg border border-ochre/35 bg-ochre/8 p-2.5">
            <Award size={16} className="text-ochre" />
            <span className="text-[11.5px] text-ink">Certificate earned</span>
            <ArrowRight size={13} className="ml-auto text-faint" />
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <div className="-mx-4 -mt-6 sm:-mx-6 lg:-mx-8 lg:-mt-8">
      <div className="grid min-h-[calc(100vh-3.5rem)] lg:grid-cols-[1fr_320px]">
        {/* main stage */}
        <div className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
              <Badge tone="neutral">Lessons</Badge>
            </button>
            <div className="flex items-center gap-2">
              <Link to={`/courses/${course.slug}`}>
                <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />}>Course home</Button>
              </Link>
              {progress?.certificateSerial && (
                <Link to="/app/certificates">
                  <Button variant="outline" size="sm" icon={<Award size={13} />}>Certificate</Button>
                </Link>
              )}
            </div>
          </div>

          {progress?.progressPct === 100 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-ochre/35 bg-ochre/8 p-4">
              <Trophy size={20} className="text-ochre" />
              <div className="flex-1">
                <p className="text-[13px] font-medium text-ink">Course complete — nicely done.</p>
                <p className="text-[11.5px] text-muted">Your certificate is ready in the certificates section.</p>
              </div>
              <Link to="/app/certificates">
                <Button size="sm" variant="primary">View certificate</Button>
              </Link>
            </div>
          )}

          {/* lesson content */}
          <div className="mx-auto max-w-4xl">
            <div className="mb-4">
              <p className="label-caps mb-1.5">
                {current?.sectionId ? course.sections.find((s) => s.id === current.sectionId)?.title : 'Lesson'}
              </p>
              <h1 className="text-[clamp(1.3rem,2.6vw,1.9rem)] leading-tight text-ink">{current?.title}</h1>
            </div>

            {isVideo ? (
              playbackLoading ? (
                <div className="flex aspect-video items-center justify-center rounded-xl border border-line bg-[#05070A]">
                  <Spinner size={24} />
                </div>
              ) : (
                <VideoPlayer
                  payload={playback}
                  isLoading={playbackLoading}
                  onCompleted={() => toast.success('Lesson complete', 'Your progress has been saved.')}
                />
              )
            ) : current?.type === 'quiz' ? (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-ochre/30 bg-ochre/8 px-6 py-14 text-center">
                <HelpCircle size={30} className="text-ochre" />
                <h2 className="text-[20px] text-ink">Assessment time</h2>
                <p className="max-w-md text-[13px] text-muted">
                  This lesson is a graded quiz. Answer the questions and reach the passing score to complete it.
                </p>
                {current.quizId ? (
                  <Link to={`/app/quiz/${current.quizId}`}>
                    <Button variant="primary" iconRight={<ArrowRight size={15} />}>Start quiz</Button>
                  </Link>
                ) : (
                  <p className="text-[12px] text-faint">Quiz is not linked yet.</p>
                )}
              </div>
            ) : current?.type === 'live' ? (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-ember/30 bg-ember/8 px-6 py-14 text-center">
                <Radio size={30} className="text-ember" />
                <h2 className="text-[20px] text-ink">Live critique room</h2>
                <p className="max-w-md text-[13px] text-muted">Join the scheduled session to take part in the discussion.</p>
                {current.liveSessionId ? (
                  <Link to={`/live/${current.liveSessionId}`}>
                    <Button variant="primary" icon={<Radio size={14} />}>Open room</Button>
                  </Link>
                ) : <p className="text-[12px] text-faint">Room is not linked yet.</p>}
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
                <Prose text={current?.body || 'Lesson content coming soon.'} />
                <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
                  <span className="text-[12px] text-muted">Finished reading?</span>
                  <Button
                    variant={completedIds.has(current?.id ?? '') ? 'secondary' : 'primary'}
                    size="sm"
                    loading={saving}
                    disabled={completedIds.has(current?.id ?? '')}
                    icon={completedIds.has(current?.id ?? '') ? <Check size={14} /> : undefined}
                    onClick={() => void markComplete()}
                  >
                    {completedIds.has(current?.id ?? '') ? 'Completed' : 'Mark complete'}
                  </Button>
                </div>
              </div>
            )}

            {/* lesson nav */}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
              {prev ? (
                <Button variant="outline" icon={<ArrowLeft size={14} />} onClick={() => goTo(prev.id)}>
                  <span className="hidden sm:inline">Previous</span>
                </Button>
              ) : <span />}
              <span className="font-mono text-[10px] text-faint">
                {currentIndex + 1} / {lessons.length}
              </span>
              {next ? (
                <Button variant="outline" iconRight={<ArrowRight size={14} />} onClick={() => goTo(next.id)}>Next</Button>
              ) : (
                <Link to="/app/certificates">
                  <Button variant="primary" iconRight={<Award size={14} />}>Finish</Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* sidebar */}
        <aside className="hidden border-l border-line bg-[color-mix(in_oklab,var(--c-surface)_62%,var(--c-canvas))] lg:block">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)]">{sidebar}</div>
        </aside>
      </div>

      {/* mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-[#05070A]/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 right-0 w-[320px] max-w-[88vw] border-l border-line bg-surface">{sidebar}</aside>
        </div>
      )}
    </div>
  );
}
