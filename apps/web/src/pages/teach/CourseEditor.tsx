import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileVideo,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { COURSE_CATEGORIES, COURSE_LEVELS, LESSON_TYPES, type LessonDTO } from '@lumen/shared';
import {
  errorMessage,
  useAddLessonMutation,
  useAddSectionMutation,
  useDeleteLessonMutation,
  useDeleteSectionMutation,
  useManageCourseQuery,
  usePresignMutation,
  useProcessVideoMutation,
  usePublishCourseMutation,
  useUnpublishCourseMutation,
  useUpdateCourseMutation,
  useUpdateLessonMutation,
  useVideoQuery,
} from '../../api';
import { useAppSelector } from '../../hooks';
import { CourseCover } from '../../components/CourseCover';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  ProgressBar,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from '../../components/ui';
import { useToast } from '../../components/Toast';
import { cn, duration, statusTone } from '../../lib/format';

type Tab = 'details' | 'curriculum' | 'media';

type DetailsState = {
  title: string;
  subtitle: string;
  description: string;
  price: string;
  category: (typeof COURSE_CATEGORIES)[number];
  level: (typeof COURSE_LEVELS)[number];
};

export default function CourseEditor() {
  const { courseId = '' } = useParams();
  const { token } = useAppSelector((state) => state.auth);
  const toast = useToast();

  const { data: course, isLoading } = useManageCourseQuery(courseId);
  const [updateCourse, { isLoading: savingDetails }] = useUpdateCourseMutation();
  const [publish, { isLoading: publishing }] = usePublishCourseMutation();
  const [unpublish] = useUnpublishCourseMutation();
  const [addSection] = useAddSectionMutation();
  const [deleteSection] = useDeleteSectionMutation();
  const [addLesson] = useAddLessonMutation();
  const [updateLesson] = useUpdateLessonMutation();
  const [deleteLesson] = useDeleteLessonMutation();
  const [presign] = usePresignMutation();
  const [processVideo] = useProcessVideoMutation();

  const [tab, setTab] = useState<Tab>('details');
  const [details, setDetails] = useState<DetailsState>({ title: '', subtitle: '', description: '', price: '0', category: COURSE_CATEGORIES[0], level: COURSE_LEVELS[0] });
  const [newSection, setNewSection] = useState('');
  const [lessonModal, setLessonModal] = useState<{ sectionId: string } | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: '', type: 'video' as string, isPreview: false, body: '' });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [watchVideoId, setWatchVideoId] = useState<string | null>(null);
  const { data: videoStatus } = useVideoQuery(watchVideoId ?? '', { skip: !watchVideoId, pollingInterval: 2500 });

  useEffect(() => {
    if (course) {
      setDetails({
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        price: String(course.price / 100),
        category: course.category as DetailsState['category'],
        level: course.level as DetailsState['level'],
      });
    }
  }, [course?.id]);

  const lessons: LessonDTO[] = (course?.lessons ?? []).slice().sort((a, b) => a.order - b.order);

  const saveDetails = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await updateCourse({
        id: courseId,
        body: {
          title: details.title,
          subtitle: details.subtitle,
          description: details.description,
          price: Math.round(Number(details.price) * 100),
          category: details.category,
          level: details.level,
        },
      }).unwrap();
      toast.success('Course details saved');
    } catch (error) {
      toast.error('Could not save', errorMessage(error));
    }
  };

  const handleAddSection = async (event: FormEvent) => {
    event.preventDefault();
    if (!newSection.trim()) return;
    try {
      await addSection({ courseId, title: newSection.trim() }).unwrap();
      setNewSection('');
      toast.success('Section added');
    } catch (error) {
      toast.error('Could not add section', errorMessage(error));
    }
  };

  const handleAddLesson = async (event: FormEvent) => {
    event.preventDefault();
    if (!lessonModal) return;
    try {
      await addLesson({
        courseId,
        sectionId: lessonModal.sectionId,
        title: lessonForm.title,
        type: lessonForm.type,
        isPreview: lessonForm.isPreview,
        body: lessonForm.body,
      }).unwrap();
      setLessonModal(null);
      setLessonForm({ title: '', type: 'video', isPreview: false, body: '' });
      toast.success('Lesson added');
    } catch (error) {
      toast.error('Could not add lesson', errorMessage(error));
    }
  };

  const handleUpload = async (lesson: LessonDTO, file: File) => {
    setUploading(lesson.id);
    try {
      const ticket = await presign({
        courseId,
        lessonId: lesson.id,
        filename: file.name,
        contentType: file.type || 'video/mp4',
        size: file.size,
      }).unwrap();

      if (ticket.driver === 'local') {
        const form = new FormData();
        form.append('file', file);
        const response = await fetch(ticket.uploadUrl, {
          method: 'POST',
          headers: token ? { authorization: `Bearer ${token}` } : {},
          body: form,
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Upload failed — check the file and try again');
      } else {
        const response = await fetch(ticket.uploadUrl, {
          method: 'PUT',
          headers: ticket.headers,
          body: file,
        });
        if (!response.ok) throw new Error('Upload failed');
      }

      await processVideo(ticket.videoId).unwrap();
      setWatchVideoId(ticket.videoId);
      toast.success('Upload received', 'FFmpeg transcoding has been queued.');
    } catch (error) {
      toast.error('Upload failed', errorMessage(error));
    } finally {
      setUploading(null);
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div>;
  }

  if (!course) {
    return <EmptyState title="Course not found" description="You may not have access to this course." action={<Link to="/teach/courses"><Button variant="secondary">Back to courses</Button></Link>} />;
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <Link to="/teach/courses" className="mt-1"><Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />}>Courses</Button></Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[24px] leading-tight text-ink">{course.title}</h1>
              <Badge tone={statusTone[course.status] ?? 'neutral'}>{course.status.replace('_', ' ')}</Badge>
            </div>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
              {course.lessons?.length ?? 0} lessons · {course.quizCount} quiz · {course.students} students · {course.paymentsMode} payments
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/courses/${course.slug}`} target="_blank">
            <Button variant="outline" size="sm" icon={<ExternalLink size={13} />}>Preview</Button>
          </Link>
          {course.status === 'published' ? (
            <Button variant="secondary" size="sm" loading={publishing} onClick={() => void unpublish(courseId).then(() => toast.success('Course unpublished'))}>Unpublish</Button>
          ) : (
            <Button variant="primary" size="sm" loading={publishing} onClick={() => void publish(courseId).then(() => toast.success('Course published')).catch((error) => toast.error('Could not publish', errorMessage(error)))}>Publish</Button>
          )}
        </div>
      </div>

      <CourseCover cover={course.cover} category={course.category} className="h-32 w-full sm:h-40" variant="banner" title={course.subtitle} />

      <Tabs
        tabs={[
          { id: 'details' as Tab, label: 'Details' },
          { id: 'curriculum' as Tab, label: 'Curriculum', count: lessons.length },
          { id: 'media' as Tab, label: 'Video pipeline' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* ── details ─────────────────────────────────────────────────── */}
      {tab === 'details' && (
        <form onSubmit={(event) => void saveDetails(event)} className="max-w-3xl space-y-5">
          <div className="card space-y-4 p-5">
            <Field label="Title" htmlFor="edit-title" required>
              <Input id="edit-title" required value={details.title} onChange={(event) => setDetails((d) => ({ ...d, title: event.target.value }))} />
            </Field>
            <Field label="Subtitle" htmlFor="edit-subtitle">
              <Input id="edit-subtitle" value={details.subtitle} onChange={(event) => setDetails((d) => ({ ...d, subtitle: event.target.value }))} />
            </Field>
            <Field label="Description" htmlFor="edit-description" hint="Supports ## headings, - lists, 1. lists and > quotes">
              <Textarea id="edit-description" className="min-h-[220px]" value={details.description} onChange={(event) => setDetails((d) => ({ ...d, description: event.target.value }))} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Price (USD)" htmlFor="edit-price">
                <Input id="edit-price" type="number" min={0} step="1" value={details.price} onChange={(event) => setDetails((d) => ({ ...d, price: event.target.value }))} />
              </Field>
              <Field label="Category" htmlFor="edit-category">
                <Select id="edit-category" value={details.category} onChange={(event) => setDetails((d) => ({ ...d, category: event.target.value as DetailsState['category'] }))}>
                  {COURSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                </Select>
              </Field>
              <Field label="Level" htmlFor="edit-level">
                <Select id="edit-level" value={details.level} onChange={(event) => setDetails((d) => ({ ...d, level: event.target.value as DetailsState['level'] }))}>
                  {COURSE_LEVELS.map((level) => <option key={level}>{level}</option>)}
                </Select>
              </Field>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={savingDetails}>Save changes</Button>
          </div>
        </form>
      )}

      {/* ── curriculum ─────────────────────────────────────────────── */}
      {tab === 'curriculum' && (
        <div className="max-w-3xl space-y-5">
          <form onSubmit={(event) => void handleAddSection(event)} className="flex items-end gap-2">
            <Field label="New section" className="flex-1" htmlFor="new-section">
              <Input id="new-section" value={newSection} onChange={(event) => setNewSection(event.target.value)} placeholder="e.g. Foundations" />
            </Field>
            <Button type="submit" variant="primary" icon={<Plus size={14} />}>Add section</Button>
          </form>

          {course.sections.length === 0 ? (
            <EmptyState icon={<GripVertical size={18} />} title="No sections yet" description="Add a section, then create lessons inside it." />
          ) : (
            <div className="space-y-3">
              {course.sections.map((section) => {
                const sectionLessons = lessons.filter((lesson) => lesson.sectionId === section.id);
                const open = openSections[section.id] ?? true;
                return (
                  <div key={section.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                    <div className="flex items-center justify-between gap-2 bg-raised/40 px-4 py-3">
                      <button onClick={() => setOpenSections((state) => ({ ...state, [section.id]: !open }))} className="flex flex-1 items-center gap-2 text-left">
                        <ChevronDown size={14} className={cn('text-faint transition-transform', open && 'rotate-180')} />
                        <span className="text-[13px] font-medium text-ink">{section.title}</span>
                        <span className="font-mono text-[9.5px] text-faint">{sectionLessons.length} lessons</span>
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Plus size={13} />}
                        onClick={() => setLessonModal({ sectionId: section.id })}
                      >
                        Add lesson
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 size={13} />}
                        onClick={() => { if (confirm('Delete this section and its lessons?')) void deleteSection({ courseId, sectionId: section.id }).then(() => toast.success('Section deleted')); }}
                      />
                    </div>
                    {open && (
                      <ul className="divide-y divide-line">
                        {sectionLessons.length === 0 ? (
                          <li className="px-4 py-6 text-center text-[12px] text-faint">No lessons in this section.</li>
                        ) : sectionLessons.map((lesson) => (
                          <li key={lesson.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <GripVertical size={13} className="text-faint" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12.5px] text-ink">{lesson.title}</p>
                              <p className="mt-0.5 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">
                                <span>{lesson.type}</span>
                                {lesson.type === 'video' && <><span>·</span><span className="flex items-center gap-0.5"><Clock3 size={9} /> {duration(lesson.video?.durationSec ?? lesson.durationSec)}</span></>}
                                {lesson.isPreview && <Badge tone="verdigris">Preview</Badge>}
                                {lesson.quizId && <Badge tone="ochre">Quiz</Badge>}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<Pencil size={12} />}
                              onClick={() => {
                                const title = prompt('Lesson title', lesson.title);
                                if (title && title !== lesson.title) {
                                  void updateLesson({ courseId, lessonId: lesson.id, body: { title } }).unwrap().then(() => toast.success('Lesson updated')).catch((error) => toast.error('Update failed', errorMessage(error)));
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<Trash2 size={12} />}
                              onClick={() => { if (confirm('Delete this lesson?')) void deleteLesson({ courseId, lessonId: lesson.id }).then(() => toast.success('Lesson deleted')); }}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── media ──────────────────────────────────────────────────── */}
      {tab === 'media' && (
        <div className="max-w-3xl space-y-4">
          <div className="rounded-xl border border-line bg-[color-mix(in_oklab,var(--c-surface)_55%,var(--c-canvas))] p-4">
            <p className="label-caps mb-2">Encoding pipeline</p>
            <p className="text-[12px] leading-relaxed text-muted">
              Upload a source video to any lesson. The API produces a 360p/720p HLS ladder with poster frames and a
              thumbnail track through FFmpeg and a BullMQ/local queue. Progress polls live below.
            </p>
          </div>

          {videoStatus && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] text-ink">Transcode job</p>
                <Badge tone={statusTone[videoStatus.status] ?? 'neutral'} dot={videoStatus.status === 'processing'}>{videoStatus.status}</Badge>
              </div>
              <ProgressBar value={videoStatus.progress} className="mt-3" />
              <p className="mt-2 font-mono text-[10px] text-faint">{videoStatus.progress}% · {duration(videoStatus.durationSec)} output</p>
            </div>
          )}

          {lessons.filter((lesson) => lesson.type === 'video').length === 0 ? (
            <EmptyState icon={<FileVideo size={18} />} title="No video lessons" description="Add a video lesson in the curriculum tab to upload a source file." />
          ) : (
            <div className="space-y-2">
              {lessons.filter((lesson) => lesson.type === 'video').map((lesson) => {
                const video = lesson.video;
                const status = video?.status ?? 'missing';
                return (
                  <div key={lesson.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3.5">
                    <span className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg',
                      status === 'ready' ? 'bg-verdigris/10 text-verdigris' : 'bg-raised text-muted',
                    )}>
                      {status === 'processing' || status === 'queued' ? <Loader2 size={16} className="animate-spin" /> : <FileVideo size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] text-ink">{lesson.title}</p>
                      <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">
                        {status} · {video?.originalName ?? 'no source'}
                      </p>
                    </div>
                    {status === 'ready' && <Badge tone="verdigris" dot>Ready</Badge>}
                    <label className={cn(
                      'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[11.5px] text-muted transition-colors hover:border-line-strong hover:text-ink',
                      uploading === lesson.id && 'pointer-events-none opacity-50',
                    )}>
                      {uploading === lesson.id ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                      {uploading === lesson.id ? 'Uploading…' : video ? 'Replace' : 'Upload'}
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleUpload(lesson, file);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-[11.5px] text-muted">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-verdigris" />
            Seeded demo courses already have a real encoded ladder — every lesson plays over HLS out of the box.
          </div>
        </div>
      )}

      {/* lesson modal */}
      <Modal
        open={Boolean(lessonModal)}
        onClose={() => setLessonModal(null)}
        title="Add a lesson"
        description="Pick a type now — you can upload video content in the Video pipeline tab."
      >
        <form onSubmit={(event) => void handleAddLesson(event)} className="space-y-4">
          <Field label="Title" required htmlFor="lesson-title">
            <Input id="lesson-title" required value={lessonForm.title} onChange={(event) => setLessonForm((f) => ({ ...f, title: event.target.value }))} placeholder="A clear, specific lesson title" />
          </Field>
          <Field label="Type" htmlFor="lesson-type">
            <Select id="lesson-type" value={lessonForm.type} onChange={(event) => setLessonForm((f) => ({ ...f, type: event.target.value }))}>
              {LESSON_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </Select>
          </Field>
          {lessonForm.type !== 'video' && (
            <Field label="Body" htmlFor="lesson-body" hint="Markdown-ish text with ## headings and lists">
              <Textarea id="lesson-body" value={lessonForm.body} onChange={(event) => setLessonForm((f) => ({ ...f, body: event.target.value }))} />
            </Field>
          )}
          <label className="flex items-center gap-2 text-[12px] text-muted">
            <input type="checkbox" checked={lessonForm.isPreview} onChange={(event) => setLessonForm((f) => ({ ...f, isPreview: event.target.checked }))} className="accent-ember" />
            Free preview (visible before enrolment)
          </label>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={() => setLessonModal(null)}>Cancel</Button>
            <Button type="submit" variant="primary">Add lesson</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
