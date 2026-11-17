import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Radio, Video } from 'lucide-react';
import { useLiveUpcomingQuery } from '../../api';
import { Badge, Button, EmptyState, Skeleton, Tabs } from '../../components/ui';
import { dateTime, fullDate, statusTone } from '../../lib/format';

type Filter = 'all' | 'live' | 'scheduled' | 'ended';

export default function StudentLive() {
  const { data: sessions = [], isLoading } = useLiveUpcomingQuery();
  const [filter, setFilter] = useState<Filter>('all');

  const counts = {
    all: sessions.length,
    live: sessions.filter((s) => s.status === 'live').length,
    scheduled: sessions.filter((s) => s.status === 'scheduled').length,
    ended: sessions.filter((s) => s.status === 'ended').length,
  };

  const visible = sessions.filter((s) => filter === 'all' || s.status === filter);

  return (
    <div className="space-y-7">
      <div>
        <p className="label-caps mb-2">Live rooms</p>
        <h1 className="text-[clamp(1.8rem,3.4vw,2.5rem)] leading-none text-ink">Your live classes.</h1>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted">
          Scheduled critique rooms for the courses you teach or take. Join when the host opens the room — camera and
          chat work right in the browser.
        </p>
      </div>

      <Tabs
        tabs={[
          { id: 'all' as Filter, label: 'All', count: counts.all },
          { id: 'live' as Filter, label: 'Live now', count: counts.live },
          { id: 'scheduled' as Filter, label: 'Scheduled', count: counts.scheduled },
          { id: 'ended' as Filter, label: 'Ended', count: counts.ended },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Radio size={20} />}
          title={filter === 'live' ? 'No rooms live right now' : 'Nothing here yet'}
          description="Enrol in a course with live sessions, or check back when the host opens the next room."
          action={<Link to="/courses"><Button size="sm" variant="secondary">Browse courses</Button></Link>}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((session) => (
            <div key={session.id} className="card hover-lift flex flex-wrap items-center gap-4 p-4 sm:p-5">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                session.status === 'live'
                  ? 'border-ember/40 bg-ember/10 text-ember'
                  : 'border-line bg-raised text-muted'
              }`}>
                {session.status === 'live' ? <Radio size={18} /> : <Video size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-medium text-ink">{session.title}</p>
                  <Badge tone={statusTone[session.status] ?? 'neutral'} dot={session.status === 'live'}>
                    {session.status}
                  </Badge>
                  {session.isHost && <Badge tone="ochre">Host</Badge>}
                </div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                  <CalendarClock size={10} className="mr-1 inline" />
                  {fullDate(session.scheduledAt)} · {dateTime(session.scheduledAt)}
                  {session.courseTitle && ` · ${session.courseTitle}`}
                </p>
                {session.description && (
                  <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-muted">{session.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {session.status === 'ended' ? (
                  <Badge tone="neutral">Finished</Badge>
                ) : (
                  <Link to={`/live/${session.id}`}>
                    <Button variant={session.status === 'live' ? 'primary' : 'outline'} icon={<Video size={14} />}>
                      {session.status === 'live' ? 'Join now' : 'Enter room'}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
