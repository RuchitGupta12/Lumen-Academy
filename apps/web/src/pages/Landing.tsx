import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Clapperboard,
  Cloud,
  Cpu,
  PlayCircle,
  Radio,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import { useCoursesQuery } from '../api';
import { CourseCard } from '../components/CourseCard';
import { CourseCover } from '../components/CourseCover';
import { Badge, Button, ProgressBar, SectionHeading, Skeleton } from '../components/ui';
import { longDuration } from '../lib/format';

const pipeline = [
  {
    icon: Clapperboard,
    step: '01',
    title: 'Instructor uploads a master',
    body: 'A presigned upload lands the source file in object storage. The lesson is locked into a draft until encoding finishes.',
  },
  {
    icon: Cpu,
    step: '02',
    title: 'FFmpeg builds an adaptive ladder',
    body: 'A queued worker probes the source, transcodes 360p and 720p HLS renditions, renders poster frames and a thumbnail track.',
  },
  {
    icon: Cloud,
    step: '03',
    title: 'CloudFront serves signed HLS',
    body: 'Playback authorises a short-lived cookie, then the player streams fMP4 segments from the edge with progress written back.',
  },
];

export default function Landing() {
  const { data, isLoading } = useCoursesQuery({ pageSize: '6', sort: 'popular' });
  const featured = data?.items?.slice(0, 3) ?? [];
  const spotlight = data?.items?.[0];

  return (
    <div>
      {/* ── hero ─────────────────────────────────────────────────────── */}
      <section className="grain relative overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(60% 55% at 78% 18%, rgba(255,106,61,0.13), transparent 70%), radial-gradient(45% 45% at 12% 88%, rgba(95,179,161,0.09), transparent 70%)',
          }}
        />
        <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="animate-rise">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Badge tone="ember" dot>
                Enrolment open
              </Badge>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                Craft education · no cohort lockstep
              </span>
            </div>

            <h1 className="display text-[clamp(2.9rem,6.4vw,5.1rem)] text-ink">
              Learn the craft,
              <br />
              not just the{' '}
              <span className="relative inline-block text-ember">
                syntax
                <svg
                  viewBox="0 0 220 12"
                  className="absolute -bottom-1 left-0 w-full text-ember/45"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path d="M2 8c46-6 104-7 216-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </span>
              .
            </h1>

            <p className="mt-6 max-w-[480px] text-[15px] leading-relaxed text-muted">
              Studio-grade video lessons, live critique rooms and graded assessments from people who ship the work.
              Finish a course and earn a certificate with a verifiable serial — not a badge graphic.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/courses">
                <Button size="lg" variant="primary" iconRight={<ArrowRight size={16} />}>
                  Browse the catalog
                </Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="secondary" icon={<PlayCircle size={16} />}>
                  Create a free account
                </Button>
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-6">
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-2">
                  {['Maya Chen', 'Dev Patel', 'Lena Ortiz'].map((name, index) => (
                    <span
                      key={name}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-canvas bg-raised font-mono text-[9px] uppercase text-muted"
                      style={{ zIndex: 3 - index }}
                    >
                      {name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')}
                    </span>
                  ))}
                </div>
                <div className="leading-tight">
                  <p className="text-[11.5px] text-ink">Working practitioners</p>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">Not career lecturers</p>
                </div>
              </div>
              <div className="h-8 w-px bg-line" />
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-0.5 text-ochre">
                  {[0, 1, 2, 3, 4].map((star) => (
                    <Star key={star} size={11} className="fill-ochre" />
                  ))}
                </span>
                <span className="font-mono text-[10.5px] text-muted">4.8 / 5 from learners</span>
              </div>
            </div>
          </div>

          {/* hero visual — real course record */}
          <div className="relative animate-rise [animation-delay:120ms]">
            <div className="absolute -inset-6 -z-10 rounded-[28px] border border-line/60 bg-surface/25 blur-[1px]" />
            {spotlight ? (
              <Link to={`/courses/${spotlight.slug}`} className="group block">
                <div className="overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)]">
                  <CourseCover
                    cover={spotlight.cover}
                    category={spotlight.category}
                    level={spotlight.level}
                    className="aspect-[4/3] rounded-none"
                    variant="hero"
                  />
                  <div className="space-y-3 p-5">
                    <div className="flex items-center justify-between">
                      <Badge tone="ember">Featured course</Badge>
                      <span className="font-mono text-[10px] text-faint">{spotlight.stats.lessonCount} lessons</span>
                    </div>
                    <h2 className="text-[22px] leading-tight text-ink transition-colors group-hover:text-ember">
                      {spotlight.title}
                    </h2>
                    <p className="text-[12.5px] leading-relaxed text-muted">{spotlight.subtitle}</p>
                    <div className="flex items-center justify-between border-t border-line pt-3">
                      <span className="text-[11.5px] text-muted">{spotlight.instructor.name}</span>
                      <span className="font-mono text-[11px] text-ink">{longDuration(spotlight.stats.durationSec)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ) : (
              <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            )}

            {/* floating encode card */}
            <div className="absolute -left-4 bottom-8 hidden w-[210px] rounded-xl border border-line-strong bg-canvas/95 p-3 shadow-2xl backdrop-blur sm:block">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-verdigris/15 text-verdigris">
                  <BadgeCheck size={13} />
                </span>
                <div className="leading-tight">
                  <p className="text-[10.5px] text-ink">HLS ladder ready</p>
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-faint">720p · 360p · fMP4</p>
                </div>
              </div>
              <ProgressBar value={100} tone="verdigris" height={3} className="mt-2.5" />
            </div>

            <div className="absolute -right-3 top-10 hidden rounded-xl border border-line-strong bg-canvas/95 px-3 py-2 shadow-2xl backdrop-blur md:block">
              <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-faint">Live in 10 minutes</p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink">
                <Radio size={11} className="text-ember" /> Architecture review
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── practice strip ───────────────────────────────────────────── */}
      <section className="overflow-hidden border-b border-line py-4">
        <div className="marquee-mask flex items-center gap-8 overflow-hidden">
          <div className="flex shrink-0 items-center gap-8 animate-[shimmer_0s]">
            {['React architecture', 'Design tokens', 'Model evaluation', 'Runway modelling', 'Documentary sound', 'Technical writing', 'Rust ownership'].map(
              (item) => (
                <span key={item} className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                  <span className="h-1 w-1 rounded-full bg-ember/60" />
                  {item}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ── featured courses ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6">
        <SectionHeading
          eyebrow="The catalog"
          title="Courses with a point of view"
          description="Each course is built around a decision you'll actually face — and assessed on whether you can make it."
          action={
            <Link to="/courses">
              <Button variant="outline" size="sm" iconRight={<ArrowRight size={14} />}>
                All {data?.total ?? ''} courses
              </Button>
            </Link>
          }
        />

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? [0, 1, 2].map((index) => <Skeleton key={index} className="h-[330px] rounded-xl" />)
            : featured.map((course) => <CourseCard key={course.id} course={course} />)}
        </div>
      </section>

      {/* ── pipeline ─────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-[color-mix(in_oklab,var(--c-surface)_55%,var(--c-canvas))]">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="label-caps mb-3">Under the hood</p>
              <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] leading-[1.05] text-ink">
                Video that behaves like
                <br />
                infrastructure, not a file.
              </h2>
              <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-muted">
                Every upload runs through the same pipeline the platform uses in production: a real FFmpeg ladder,
                a queue with retries, signed delivery, and a player that reports watch progress back to the course
                record.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge tone="neutral">FFmpeg</Badge>
                <Badge tone="neutral">BullMQ</Badge>
                <Badge tone="neutral">CloudFront</Badge>
                <Badge tone="neutral">Socket.IO</Badge>
                <Badge tone="neutral">RTK Query</Badge>
              </div>
              <div className="mt-7 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
                <ShieldCheck size={14} className="text-verdigris" />
                <p className="text-[11.5px] text-muted">
                  Playback is gated by a signed cookie. Segments never travel with a public URL.
                </p>
              </div>
            </div>

            <ol className="space-y-3">
              {pipeline.map((item) => (
                <li key={item.step} className="card hover-lift flex gap-4 p-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-raised text-ember">
                      <item.icon size={16} />
                    </span>
                    <span className="font-mono text-[9.5px] text-faint">{item.step}</span>
                  </div>
                  <div>
                    <h3 className="font-sans text-[13.5px] font-medium tracking-[-0.01em] text-ink">{item.title}</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── live classes ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-ember/25 bg-[color-mix(in_oklab,var(--c-surface)_70%,var(--c-canvas))] p-7 sm:p-10">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(55% 80% at 92% 15%, rgba(255,106,61,0.18), transparent 60%)' }}
          />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-ember/40 bg-ember/10 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ember">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember" /> Live rooms
                </span>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">WebRTC · chat · presence</span>
              </div>
              <h2 className="max-w-lg text-[clamp(1.7rem,3.2vw,2.4rem)] leading-[1.08] text-ink">
                Bring your work. Leave with a direction.
              </h2>
              <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed text-muted">
                Instructors open critique rooms on a schedule. Camera on, screen shared, questions answered live —
                with a realtime chat backchannel that stays with the course.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/register">
                  <Button variant="primary" icon={<Radio size={15} />}>
                    Join the next class
                  </Button>
                </Link>
                <Link to="/live">
                  <Button variant="ghost" iconRight={<ArrowRight size={14} />}>
                    How live rooms work
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative rounded-xl border border-line bg-canvas/60 p-4">
              <div className="flex items-center justify-between">
                <span className="label-caps">Room preview</span>
                <span className="font-mono text-[9px] text-faint">SFU</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {['Maya', 'Aarav', 'Sofia', 'Jonas'].map((name, index) => (
                  <div
                    key={name}
                    className="flex aspect-[4/3] items-center justify-center rounded-lg border border-line bg-raised"
                    style={{ background: index === 0 ? 'linear-gradient(140deg,#2C3E50,#0B0D11)' : undefined }}
                  >
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-white/60">{name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                <p className="rounded-md bg-raised px-2 py-1.5 text-[10.5px] text-muted">
                  <span className="text-verdigris">Sofia</span> Can we look at optimistic rollback?
                </p>
                <p className="rounded-md bg-raised px-2 py-1.5 text-[10.5px] text-muted">
                  <span className="text-ochre">Maya</span> Exactly what we're refactoring now.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── certificates ─────────────────────────────────────────────── */}
      <section className="border-y border-line bg-[color-mix(in_oklab,var(--c-surface)_45%,var(--c-canvas))]">
        <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <p className="label-caps mb-3">Credentials</p>
            <h2 className="text-[clamp(1.7rem,3.2vw,2.4rem)] leading-[1.08] text-ink">
              A certificate with a
              <br />
              serial you can check.
            </h2>
            <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-muted">
              Finish every lesson and the passing assessment, and Lumen issues a PDF certificate with a unique serial
              and a QR code. Anyone can verify it against the public registry — no login required.
            </p>
            <ul className="mt-5 space-y-2">
              {[
                'Issued only after 100% of lessons are complete',
                'Serial + QR resolves to a public verification page',
                'Course, instructor, learner and issue date on record',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[12.5px] text-muted">
                  <BadgeCheck size={14} className="mt-[2px] shrink-0 text-verdigris" />
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/verify" className="mt-6 inline-block">
              <Button variant="outline" size="sm" icon={<Sparkles size={13} />}>
                Try the registry
              </Button>
            </Link>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative mx-auto max-w-[460px] rotate-[-1.2deg] rounded-lg border border-[#d8d0bf] bg-[#F7F3EA] p-6 text-[#14161B] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.75)]">
              <div className="absolute inset-3 border border-[#14161B]/70" />
              <div className="absolute inset-[14px] border border-[#E2542A]/70" />
              <div className="relative px-3 py-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-[7.5px] uppercase tracking-[0.22em]">Lumen Academy</p>
                    <p className="mt-0.5 font-mono text-[6.5px] uppercase tracking-[0.16em] text-[#3E7F70]">
                      Certificate registry · verified issue
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E2542A]">
                    <span className="font-display text-[20px] leading-none">L</span>
                  </div>
                </div>
                <p className="mt-7 font-mono text-[6.5px] uppercase tracking-[0.2em] text-[#E2542A]">
                  Certificate of completion
                </p>
                <p className="mt-2 font-display text-[17px] leading-none">This certifies that</p>
                <p className="mt-2 font-display text-[26px] leading-none">Aarav Mehta</p>
                <div className="mt-3 h-px bg-[#14161B]/20" />
                <p className="mt-3 text-[7.5px] uppercase tracking-[0.1em] text-[#4B4F57]">has successfully completed</p>
                <p className="mt-1 text-[12px] font-semibold leading-tight">Production-Grade React Architecture</p>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="font-display text-[11px] italic text-[#14161B]">Maya Chen</p>
                    <div className="mt-1 h-px w-24 bg-[#14161B]" />
                    <p className="mt-1 font-mono text-[5.5px] uppercase tracking-[0.14em] text-[#5D626C]">Course instructor</p>
                  </div>
                  <p className="font-mono text-[6px] text-[#5D626C]">LMN-2026-4F8A2C</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── final CTA ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1180px] px-4 py-20 text-center sm:px-6">
        <p className="label-caps mb-4">Start where you are</p>
        <h2 className="mx-auto max-w-2xl text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.02] text-ink">
          The next thing you build should be <span className="italic text-ember">better</span> than the last.
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register">
            <Button size="lg" variant="primary" iconRight={<ArrowRight size={16} />}>
              Create your account
            </Button>
          </Link>
          <Link to="/courses">
            <Button size="lg" variant="secondary">
              Compare courses
            </Button>
          </Link>
        </div>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          Demo build · payments in test mode · seeded instructor and learner accounts
        </p>
      </section>
    </div>
  );
}
