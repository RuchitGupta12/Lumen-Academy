import { Course } from '../models/course';
import { Lesson } from '../models/lesson';

/** Recompute denormalised lesson count + duration after any curriculum edit. */
export async function recomputeCourseStats(courseId: string) {
  const lessons = await Lesson.find({ course: courseId }).select('durationSec').lean();
  const durationSec = lessons.reduce((sum, lesson: any) => sum + (lesson.durationSec ?? 0), 0);
  await Course.updateOne(
    { _id: courseId },
    { $set: { 'stats.lessonCount': lessons.length, 'stats.durationSec': durationSec } },
  );
  return { lessonCount: lessons.length, durationSec };
}

export async function touchCourse(courseId: string) {
  await Course.updateOne({ _id: courseId }, { $set: { updatedAt: new Date() } });
}
