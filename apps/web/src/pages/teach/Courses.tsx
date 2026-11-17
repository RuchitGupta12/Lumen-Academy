import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ExternalLink, Plus, Users } from 'lucide-react';
import { COURSE_CATEGORIES, COURSE_LEVELS, type CourseInput } from '@lumen/shared';
import { errorMessage, useCreateCourseMutation, useInstructorCoursesQuery } from '../../api';
import { CourseCover } from '../../components/CourseCover';
import { Badge, Button, EmptyState, Field, Input, Modal, Select, Skeleton } from '../../components/ui';
import { compactMoney, statusTone } from '../../lib/format';
import { useToast } from '../../components/Toast';

const PALETTES = [
  { from: '#2C3E50', to: '#0B0D11', motif: 'L' },
  { from: '#3B2A22', to: '#120A08', motif: 'A' },
  { from: '#1E3834', to: '#0A1211', motif: 'D' },
  { from: '#2A2440', to: '#0D0A16', motif: 'R' },
];

export default function TeachCourses() {
  const { data: courses = [], isLoading } = useInstructorCoursesQuery();
  const [create, { isLoading: creating }] = useCreateCourseMutation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', subtitle: '', category: COURSE_CATEGORIES[0], level: COURSE_LEVELS[0], price: '4900' });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const palette = PALETTES[courses.length % PALETTES.length]!;
      const body: CourseInput = {
        title: form.title,
        subtitle: form.subtitle,
        description: `## About this course\n\n${form.subtitle || 'A new Lumen course.'}\n\nBuild something worth shipping.`,
        category: form.category,
        level: form.level,
        price: Number(form.price),
        tags: [],
        cover: palette,
      };
      const course = await create(body).unwrap();
      toast.success('Course created', 'Add sections and lessons next.');
      setOpen(false);
      setForm({ title: '', subtitle: '', category: COURSE_CATEGORIES[0], level: COURSE_LEVELS[0], price: '4900' });
      window.location.assign(`/teach/courses/${course.id}`);
    } catch (error) {
      toast.error('Could not create course', errorMessage(error));
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps mb-2">Authoring</p>
          <h1 className="text-[clamp(1.8rem,3.4vw,2.5rem)] leading-none text-ink">Your courses.</h1>
          <p className="mt-3 text-[13px] text-muted">Build the curriculum, upload video through the encoding pipeline, then publish.</p>
        </div>
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setOpen(true)}>New course</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={20} />}
          title="No courses yet"
          description="Create your first course to start building a curriculum and earning revenue."
          action={<Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setOpen(true)}>Create a course</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="hidden grid-cols-[1fr_100px_90px_90px_120px] gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid">
            {['Course', 'Status', 'Students', 'Revenue', 'Updated'].map((heading) => (
              <span key={heading} className="label-caps">{heading}</span>
            ))}
          </div>
          <div className="divide-y divide-line bg-surface">
            {courses.map((course) => (
              <Link key={course.id} to={`/teach/courses/${course.id}`} className="grid gap-3 px-4 py-3 transition-colors hover:bg-raised/60 md:grid-cols-[1fr_100px_90px_90px_120px] md:items-center md:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <CourseCover cover={course.cover} className="h-12 w-20 shrink-0" variant="thumb" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{course.title}</p>
                    <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">{course.category} · {course.lessons} lessons</p>
                  </div>
                </div>
                <div><Badge tone={statusTone[course.status] ?? 'neutral'}>{course.status.replace('_', ' ')}</Badge></div>
                <div className="flex items-center gap-1 font-mono text-[11px] text-muted"><Users size={12} /> {course.students}</div>
                <div className="font-mono text-[11px] text-verdigris">{compactMoney(course.revenue)}</div>
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-faint">
                  {new Date(course.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  <ExternalLink size={13} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create a course"
        description="Start with the essentials — you can refine everything in the editor."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="new-course-form" variant="primary" loading={creating}>Create course</Button>
          </>
        }
      >
        <form id="new-course-form" onSubmit={(event) => void submit(event)} className="space-y-4">
          <Field label="Title" required htmlFor="new-title">
            <Input id="new-title" required minLength={6} value={form.title} onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))} placeholder="Production-Grade React Architecture" />
          </Field>
          <Field label="Subtitle" htmlFor="new-subtitle">
            <Input id="new-subtitle" value={form.subtitle} onChange={(event) => setForm((f) => ({ ...f, subtitle: event.target.value }))} placeholder="One line on what changes for the learner" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="new-category">
              <Select id="new-category" value={form.category} onChange={(event) => setForm((f) => ({ ...f, category: event.target.value as typeof f.category }))}>
                {COURSE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </Select>
            </Field>
            <Field label="Level" htmlFor="new-level">
              <Select id="new-level" value={form.level} onChange={(event) => setForm((f) => ({ ...f, level: event.target.value as typeof f.level }))}>
                {COURSE_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Price (USD, dollars)" htmlFor="new-price" hint="Stored in cents on the server · 0 makes it free">
            <Input id="new-price" type="number" min={0} step="1" value={form.price} onChange={(event) => setForm((f) => ({ ...f, price: event.target.value }))} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
