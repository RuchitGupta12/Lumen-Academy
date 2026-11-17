import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Captions,
  MessageSquare,
  MonitorUp,
  Radio,
  ScreenShare,
  Users,
  Video,
} from 'lucide-react';
import { useAppSelector } from '../hooks';
import { useLiveUpcomingQuery } from '../api';
import { Badge, Button, EmptyState, Skeleton } from '../components/ui';
import { dateTime, statusTone } from '../lib/format';

const features = [
  {
    icon: Video,
    title: 'Camera-on conversation',
    body: 'Small rooms with people who are doing the work. See the instructor think through a problem, not just watch a finished answer.',
  },
  {
    icon: MonitorUp,
    title: 'Screen share & critique',
    body: 'Bring your own project. The room is built around reviewing real work, annotating decisions and rewriting on the spot.',
  },
  {
    icon: MessageSquare,
    title: 'Realtime backchannel',
    body: 'Ask questions in chat while the class runs. Presence, messages and status changes are pushed live through Socket.IO.',
  },
  {
    icon: Captions,
    title: 'Recording & recap',
    body: 'Missed a session? The recording lands on the course with a chat recap, so the room is useful even after it ends.',
  },
];

export default function LivePublic() {
  const { user } = useAppSelector((state) => state.auth);
  const { data, isLoading } = useLiveUpcomingQuery(undefined, { skip: !user });

  const live = data?.filter((session) => session.status === 'live') ?? [];
  const upcoming = data?.filter((session) => session.status === 'scheduled').slice(0, 4) ?? [];

  return (
    <div>
      <section className="grain relative overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(55% 60% at 75% 20%, rgba(255,106,61,0.14), transparent 68%)' }}
        />
        <div className="relative mx-auto grid max-w-[1180px] items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div>
            <Badge tone="ember" dot>Live rooms</Badge>
            <h1 className="mt-5 max-w-xl text-[clamp(2.3rem,5vw,3.8rem)] leading-[1.02] text-ink">
              Bring your work.
              <br />
              Leave with a <span className="italic text-ember">direction.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted">
              Scheduled critique rooms run by working practitioners. Camera on, screen shared, questions answered in
              real time — with a chat backchannel that stays with the course.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <Link to="/app/live">
                  <Button size="lg" variant="primary" iconRight={<ArrowRight size={16} />}>
                    My live classes
                  </Button>
                </Link>
              ) : (
                <Link to="/register">
                  <Button size="lg" variant="primary" iconRight={<ArrowRight size={16} />}>
                    Create a free account
                  </Button>
                </Link>
              )}
              <Link to="/courses">
                <Button size="lg" variant="secondary">Browse courses</Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-5 border-t border-line pt-6 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-ember" /> WebRTC / LiveKit</span>
              <span className="flex items-center gap-1.5"><Users size={12} /> Small rooms</span>
              <span className="flex items-center gap-1.5"><MessageSquare size={12} /> Live chat</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[26px] border border-line bg-surface/30" />
            <div className="overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[0_40px_90px_-45px_rgba(0,0,0,0.9)]">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-ember" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Architecture review · room 04</span>
                </div>
                <span className="font-mono text-[9.5px] text-faint">4 participants</span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                {[
                  { name: 'Maya', color: 'linear-gradient(140deg,#3B2A22,#0B0D11)', host: true },
                  { name: 'Aarav', color: 'linear-gradient(140deg,#1E2E2A,#0B0D11)' },
                  { name: 'Sofia', color: 'linear-gradient(140deg,#272438,#0B0D11)' },
                  { name: 'Jonas', color: 'linear-gradient(140deg,#302A1E,#0B0D11)' },
                ].map((person) => (
                  <div
                    key={person.name}
                    className="relative flex aspect-[4/3] items-end justify-start overflow-hidden rounded-lg border border-line p-2.5"
                    style={{ background: person.color }}
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/70">{person.name}</span>
                    {person.host && (
                      <span className="absolute right-2 top-2 rounded-full border border-ember/50 bg-ember/15 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.1em] text-ember">
                        Host
                      </span>
                    )}
                    <ScreenShare size={13} className="absolute left-2 top-2 text-white/40" />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 border-t border-line p-3">
                <p className="rounded-md bg-raised px-2.5 py-1.5 text-[10.5px] text-muted"><span className="text-verdigris">Sofia</span> Can we look at optimistic rollback?</p>
                <p className="rounded-md bg-raised px-2.5 py-1.5 text-[10.5px] text-muted"><span className="text-ochre">Maya</span> Exactly what we are refactoring now.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card hover-lift flex gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-ember">
                <Icon size={17} />
              </span>
              <div>
                <h2 className="text-[15px] text-ink">{title}</h2>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {user && (
        <section className="border-y border-line bg-[color-mix(in_oklab,var(--c-surface)_45%,var(--c-canvas))]">
          <div className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="label-caps mb-2">Your schedule</p>
                <h2 className="text-[24px] text-ink">Rooms near you</h2>
              </div>
              <Link to="/app/live">
                <Button variant="outline" size="sm" iconRight={<ArrowRight size={14} />}>Open all</Button>
              </Link>
            </div>

            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
            ) : live.length === 0 && upcoming.length === 0 ? (
              <EmptyState
                icon={<Radio size={18} />}
                title="No rooms scheduled yet"
                description="Enrol in a course with live sessions and they will appear here."
                action={<Link to="/courses"><Button size="sm" variant="secondary">Browse courses</Button></Link>}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {[...live, ...upcoming].map((session) => (
                  <Link
                    key={session.id}
                    to={`/live/${session.id}`}
                    className="card hover-lift flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div>
                      <p className="text-[13px] text-ink">{session.title}</p>
                      <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
                        {dateTime(session.scheduledAt)} · {session.courseTitle ?? session.instructorName}
                      </p>
                    </div>
                    <Badge tone={statusTone[session.status] ?? 'neutral'} dot={session.status === 'live'}>
                      {session.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1180px] px-4 py-20 text-center sm:px-6">
        <Radio size={22} className="mx-auto text-ember" />
        <h2 className="mt-4 text-[clamp(1.8rem,3.6vw,2.6rem)] leading-[1.06] text-ink">The next room is open.</h2>
        <p className="mx-auto mt-3 max-w-md text-[13.5px] text-muted">Pick a course, enrol, and join the next critique session.</p>
        <Link to="/courses" className="mt-6 inline-block">
          <Button variant="primary" size="lg" iconRight={<ArrowRight size={16} />}>Explore courses</Button>
        </Link>
      </section>
    </div>
  );
}
