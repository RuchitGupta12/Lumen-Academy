import type { CourseDTO, LessonDTO, UserDTO, VideoDTO, LiveSessionDTO } from '@lumen/shared';
import { manifestUrl, posterUrl, thumbnailsUrl } from './media';

export const str = (value: unknown) => (value == null ? '' : String(value));

export function userToDTO(user: any): UserDTO {
  return {
    id: str(user?._id ?? user?.id),
    name: str(user?.name),
    email: str(user?.email),
    role: user?.role ?? 'student',
    avatarUrl: user?.avatarUrl ?? null,
    headline: user?.headline ?? null,
    bio: user?.bio ?? null,
    status: user?.status ?? 'active',
    createdAt: new Date(user?.createdAt ?? Date.now()).toISOString(),
  };
}

export function publicUser(user: any) {
  if (!user) return { id: '', name: 'Lumen instructor', headline: null, avatarUrl: null };
  return {
    id: str(user._id ?? user.id),
    name: str(user.name),
    headline: user.headline ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };
}

export function videoToDTO(video: any): VideoDTO | null {
  if (!video) return null;
  const id = str(video._id);
  const ready = video.status === 'ready';
  return {
    id,
    status: video.status,
    progress: Math.round(video.progress ?? 0),
    durationSec: video.durationSec ?? 0,
    error: video.error ?? null,
    originalName: video.originalName ?? null,
    hlsUrl: ready ? manifestUrl(id) : null,
    posterUrl: ready ? posterUrl(id) : null,
    thumbnailsUrl: ready ? thumbnailsUrl(id) : null,
  };
}

export function lessonToDTO(lesson: any, video?: any): LessonDTO {
  return {
    id: str(lesson._id),
    courseId: str(lesson.course),
    sectionId: str(lesson.sectionId),
    title: str(lesson.title),
    type: lesson.type ?? 'video',
    order: lesson.order ?? 0,
    durationSec: lesson.durationSec ?? 0,
    isPreview: !!lesson.isPreview,
    body: lesson.body ?? null,
    quizId: lesson.quiz ? str(lesson.quiz) : null,
    liveSessionId: lesson.liveSession ? str(lesson.liveSession) : null,
    video: video ? videoToDTO(video) : video === null ? null : lesson.video && lesson.video.status ? videoToDTO(lesson.video) : null,
  };
}

export function courseToDTO(
  course: any,
  options: { lessons?: any[]; videosById?: Map<string, any>; isEnrolled?: boolean } = {},
): CourseDTO {
  const sections = (course.sections ?? [])
    .map((section: any) => ({
      id: str(section._id),
      title: section.title,
      order: section.order ?? 0,
      lessonCount: (options.lessons ?? []).filter(
        (l) => str(l.sectionId) === str(section._id),
      ).length,
    }))
    .sort((a: any, b: any) => a.order - b.order);

  return {
    id: str(course._id),
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle ?? '',
    description: course.description ?? '',
    category: course.category,
    level: course.level,
    price: course.price ?? 0,
    status: course.status,
    tags: course.tags ?? [],
    cover: {
      from: course.cover?.from ?? '#1B2029',
      to: course.cover?.to ?? '#0B0D11',
      motif: course.cover?.motif ?? 'L',
    },
    instructor: publicUser(course.instructor),
    sections,
    lessons: options.lessons?.map((lesson) => {
      // Some routes pre-serialise lessons to apply preview visibility. Passing
      // a DTO through lessonToDTO again would blank its id and quiz link.
      if (lesson && !lesson._id && lesson.id) {
        const video = options.videosById?.get(str(lesson.id));
        return video === undefined ? lesson : { ...lesson, video: videoToDTO(video) };
      }
      return lessonToDTO(lesson, options.videosById?.get(str(lesson._id)));
    }),
    stats: {
      durationSec: course.stats?.durationSec ?? 0,
      lessonCount: course.stats?.lessonCount ?? 0,
      ratingAvg: course.stats?.ratingAvg ?? 0,
      ratingCount: course.stats?.ratingCount ?? 0,
      enrollmentCount: course.stats?.enrollmentCount ?? 0,
    },
    isEnrolled: options.isEnrolled,
    createdAt: new Date(course.createdAt ?? Date.now()).toISOString(),
    updatedAt: new Date(course.updatedAt ?? Date.now()).toISOString(),
  };
}

export function liveToDTO(session: any): LiveSessionDTO {
  return {
    id: str(session._id),
    courseId: str(session.course?._id ?? session.course),
    courseTitle: session.course?.title ?? undefined,
    instructorName: session.instructor?.name ?? undefined,
    title: str(session.title),
    description: session.description ?? '',
    scheduledAt: new Date(session.scheduledAt).toISOString(),
    status: session.status,
    roomName: str(session.roomName),
    recordingUrl: session.recordingUrl ?? null,
  };
}
