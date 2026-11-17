import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarPlus, Clock3, Radio, Users, Video } from 'lucide-react';
import {
  errorMessage,
  useCreateLiveMutation,
  useInstructorCoursesQuery,
  useLiveUpcomingQuery,
  useSetLiveStatusMutation,
} from '../../api';
import { Badge, Button, EmptyState, Field, Input, Modal, Select, Skeleton, Textarea } from '../../components/ui';
import { dateTime, fullDate, statusTone } from '../../lib/format';
import { useToast } from '../../components/Toast';

function defaultSchedule() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return local;
}

export default function TeachLive() {
  const toast = useToast();
  const { data: sessions = [], isLoading } = useLiveUpcomingQuery();
  const { data: courses = [] } = useInstructorCoursesQuery();
  const [createLive, { isLoading: creating }] = useCreateLiveMutation();
  const [setStatus, { isLoading: updating }] = useSetLiveStatusMutation();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ courseId: '', title: '', scheduledAt: defaultSchedule(), description: '' });

  const hosted = sessions.filter((session) => session.isHost);
  const liveNow = hosted.filter((session) => session.status === 'live');
  const scheduled = hosted.filter((session) => session.status === 'scheduled').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const ended = hosted.filter((session) => session.status === 'ended');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await createLive({
        courseId: form.courseId,
        title: form.title,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        description: form.description || undefined,
      }).unwrap();
      toast.success('Class scheduled', 'It will appear in your learners’ live schedule.');
      setOpen(false);
      setForm({ courseId: form.courseId, title: '', scheduledAt: defaultSchedule(), description: '' });
    } catch (error) {
      toast.error('Could not schedule class', errorMessage(error));
    }
  };

  const changeStatus = async (id: string, status: 'scheduled' | 'live' | 'ended') => {
    try {
      await setStatus({ id, status }).unwrap();
      toast.success(`Class ${status === 'live' ? 'started' : status === 'ended' ? 'ended' : 'reopened'}`);
    } catch (error) {
      toast.error('Could not update class', errorMessage(error));
    }
  };

  const sessionRow = (session: (typeof hosted)[number]) => (
    <div key={session.id} className="card hover-lift flex flex-wrap items-center gap-4 p-4 sm:p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
        session.status === 'live' ? 'border-ember/40 bg-ember/10 text-ember' : 'border-line bg-raised text-muted'
      }`}>
        {session.status === 'live' ? <Radio size={18} /> : <Video size={18} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[14px] font-medium text-ink">{session.title}</p>
          <Badge tone={statusTone[session.status] ?? 'neutral'} dot={session.status === 'live'}>{session.status}</Badge>
        </div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
          <Clock3 size={10} className="mr-1 inline" />
          {fullDate(session.scheduledAt)} · {dateTime(session.scheduledAt)}
          {session.courseTitle && ` · ${session.courseTitle}`}
        </p>
        {session.description && <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-muted">{session.description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {session.status === 'scheduled' && (
          <Button size="sm" variant="primary" icon={<Radio size={13} />} loading={updating} onClick={() => void changeStatus(session.id, 'live')}>
            Start
          </Button>
        )}
        {session.status === 'live' && (
          <Button size="sm" variant="danger" loading={updating} onClick={() => void changeStatus(session.id, 'ended')}>
            End class
          </Button>
        )}
        {session.status === 'ended' && (
          <Button size="sm" variant="ghost" loading={updating} onClick={() => void changeStatus(session.id, 'scheduled')}>
            Reopen
          </Button>
        )}
        {session.status !== 'ended' && (
          <Link to={`/live/${session.id}`}>
            <Button size="sm" variant={session.status === 'live' ? 'secondary' : 'outline'} iconRight={<ArrowRight size={13} />}>
              Open room
            </Button>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps mb-2">Live teaching</p>
          <h1 className="text-[clamp(1.8rem,3.4vw,2.5rem)] leading-none text-ink">Your classes.</h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted">
            Schedule critique rooms for your courses. Host controls let you open and close the room; learners join with
            camera, chat and realtime presence.
          </p>
        </div>
        <Button variant="primary" icon={<CalendarPlus size={15} />} onClick={() => setOpen(true)} disabled={courses.length === 0}>
          Schedule class
        </Button>
      </div>

      {liveNow.length > 0 && (
        <section>
          <p className="label-caps mb-3 flex items-center gap-1.5 text-ember"><Radio size={12} /> Live right now</p>
          <div className="space-y-3">{liveNow.map(sessionRow)}</div>
        </section>
      )}

      <section>
        <p className="label-caps mb-3">Scheduled</p>
        {isLoading ? (
          <div className="space-y-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>
        ) : scheduled.length === 0 ? (
          <EmptyState
            icon={<Video size={20} />}
            title="No classes scheduled"
            description="Schedule a room for one of your courses and it will appear here and in your learners' dashboards."
            action={courses.length > 0 ? <Button size="sm" variant="primary" onClick={() => setOpen(true)}>Schedule a class</Button> : undefined}
          />
        ) : (
          <div className="space-y-3">{scheduled.map(sessionRow)}</div>
        )}
      </section>

      {ended.length > 0 && (
        <section>
          <p className="label-caps mb-3">Past classes</p>
          <div className="space-y-3 opacity-70">{ended.slice(0, 6).map(sessionRow)}</div>
        </section>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-line bg-[color-mix(in_oklab,var(--c-surface)_55%,var(--c-canvas))] p-4">
        <Users size={16} className="mt-0.5 shrink-0 text-muted" />
        <p className="text-[11.5px] leading-relaxed text-muted">
          Only learners enrolled in the linked course can join a room. Rooms run in simulated mode by default; set{' '}
          <span className="font-mono text-ink">LIVE_DRIVER=livekit</span> with credentials to use a WebRTC SFU.
        </p>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule a live class"
        description="Pick a course and a time. The room opens when you press Start."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="schedule-form" variant="primary" loading={creating}>Schedule</Button>
          </>
        }
      >
        <form id="schedule-form" onSubmit={(event) => void submit(event)} className="space-y-4">
          <Field label="Course" htmlFor="live-course" required>
            <Select
              id="live-course"
              required
              value={form.courseId}
              onChange={(event) => setForm((f) => ({ ...f, courseId: event.target.value }))}
            >
              <option value="">Select a course…</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </Select>
          </Field>
          <Field label="Title" htmlFor="live-title" required>
            <Input
              id="live-title"
              required
              value={form.title}
              onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
              placeholder="Portfolio review & open critique"
            />
          </Field>
          <Field label="Date & time" htmlFor="live-time" required hint="Your local timezone — converted to UTC on save">
            <Input
              id="live-time"
              type="datetime-local"
              required
              value={form.scheduledAt}
              onChange={(event) => setForm((f) => ({ ...f, scheduledAt: event.target.value }))}
            />
          </Field>
          <Field label="Description" htmlFor="live-desc">
            <Textarea
              id="live-desc"
              value={form.description}
              onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
              placeholder="What will learners bring to this room?"
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
