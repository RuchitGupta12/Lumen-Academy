import { COMPLETION_THRESHOLD } from '@lumen/shared';
import { Certificate, Enrollment, LessonProgress } from '../models/learning';
import { Lesson } from '../models/lesson';
import { issueCertificate } from './certificates';

export async function recomputeCourseProgress(studentId: string, courseId: string) {
  const [lessons, completed, enrollment] = await Promise.all([
    Lesson.find({ course: courseId }).select('_id').lean(),
    LessonProgress.countDocuments({ student: studentId, course: courseId, completed: true }),
    Enrollment.findOne({ student: studentId, course: courseId }),
  ]);

  if (!enrollment) return null;

  const total = lessons.length;
  const pct = total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));

  enrollment.progressPct = pct as any;

  let certificateSerial: string | null = null;

  if (pct >= 100 && !enrollment.completedAt) {
    enrollment.completedAt = new Date() as any;
    const certificate = await issueCertificate(studentId, courseId);
    enrollment.certificateId = (certificate as any)._id;
    certificateSerial = (certificate as any).serial;
  } else if (enrollment.certificateId) {
    const certificate = await Certificate.findById(enrollment.certificateId).lean();
    certificateSerial = (certificate as any)?.serial ?? null;
  }

  await enrollment.save();
  return { progressPct: pct, completedAt: enrollment.completedAt, certificateSerial };
}

export function isLessonComplete(input: {
  type: string;
  watchedSeconds: number;
  durationSec: number;
  explicit?: boolean;
}) {
  if (input.explicit) return true;
  if (input.type !== 'video') return false;
  if (!input.durationSec) return false;
  return input.watchedSeconds / input.durationSec >= COMPLETION_THRESHOLD;
}

export async function upsertLessonProgress(input: {
  studentId: string;
  courseId: string;
  lessonId: string;
  watchedSeconds: number;
  durationSec: number;
  type: string;
  explicit?: boolean;
}) {
  const completed = isLessonComplete(input);
  const progress = await LessonProgress.findOneAndUpdate(
    { student: input.studentId, lesson: input.lessonId },
    {
      $set: {
        student: input.studentId,
        course: input.courseId,
        lesson: input.lessonId,
        completed,
      },
      $max: { watchedSeconds: input.watchedSeconds },
    },
    { new: true, upsert: true },
  );

  await Enrollment.updateOne(
    { student: input.studentId, course: input.courseId },
    { $set: { lastLessonId: input.lessonId } },
  );

  return progress;
}
