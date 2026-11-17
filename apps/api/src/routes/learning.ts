import fs from 'node:fs';
import { Router } from 'express';
import {
  progressInputSchema,
  quizInputSchema,
  quizSubmitSchema,
} from '@lumen/shared';
import { Course } from '../models/course';
import { Lesson } from '../models/lesson';
import { VideoAsset } from '../models/video';
import { Certificate, Enrollment, LessonProgress } from '../models/learning';
import { Quiz, QuizAttempt } from '../models/assessment';
import { Order } from '../models/commerce';
import { ApiError, asyncHandler, badRequest, forbidden, notFound, send } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { courseToDTO } from '../lib/serialize';
import { certificateToDTO, issueCertificate } from '../services/certificates';
import { recomputeCourseProgress, upsertLessonProgress } from '../services/progress';
import { gradeQuiz } from '../services/quiz';
import { certificateFile, certificateUrl } from '../lib/media';
import { isS3Enabled } from '../config/env';

const router = Router();

async function requireEnrollment(studentId: string, courseId: string) {
  const enrollment = await Enrollment.findOne({ student: studentId, course: courseId });
  if (!enrollment) throw forbidden('Enrol in this course to continue');
  return enrollment;
}

async function ownedCourse(req: any) {
  const course = await Course.findById(String(req.params.courseId)).lean();
  if (!course) throw notFound('Course not found');
  if (String(course.instructor) !== req.auth.userId && req.auth.role !== 'admin') {
    throw forbidden('This course belongs to another instructor');
  }
  return course;
}

/* ─────────────────────────────  Enrollment  ─────────────────────────── */

router.post(
  '/enrollments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { courseId } = req.body as { courseId?: string };
    if (!courseId) throw badRequest('courseId is required');

    const course = await Course.findById(courseId).lean();
    if (!course || course.status !== 'published') throw notFound('Course not found');

    const existing = await Enrollment.findOne({ student: req.auth!.userId, course: course._id }).lean();
    if (existing) return send(res, { enrolled: true, enrollmentId: String(existing._id) });

    if ((course.price ?? 0) > 0) {
      const paid = await Order.exists({
        student: req.auth!.userId,
        course: course._id,
        status: 'paid',
      });
      if (!paid) {
        throw new ApiError(402, 'payment_required', 'This is a paid course — complete checkout to enrol');
      }
    }

    const enrollment = await Enrollment.create({
      student: req.auth!.userId,
      course: course._id,
      pricePaid: 0,
      progressPct: 0,
    });
    await Course.updateOne({ _id: course._id }, { $inc: { 'stats.enrollmentCount': 1 } });

    return send(res, { enrolled: true, enrollmentId: String(enrollment._id) }, 201);
  }),
);

router.get(
  '/me/enrollments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const enrollments = await Enrollment.find({ student: req.auth!.userId })
      .sort({ updatedAt: -1 })
      .populate({
        path: 'course',
        populate: { path: 'instructor', select: 'name headline avatarUrl' },
      })
      .lean();

    const certificateIds = enrollments.map((e: any) => e.certificateId).filter(Boolean);
    const certificates = certificateIds.length
      ? await Certificate.find({ _id: { $in: certificateIds } }).lean()
      : [];
    const certificateByid = new Map(certificates.map((c: any) => [String(c._id), c]));

    const items = enrollments
      .filter((enrollment: any) => enrollment.course)
      .map((enrollment: any) => {
        const certificate = certificateByid.get(String(enrollment.certificateId));
        return {
          id: String(enrollment._id),
          courseId: String(enrollment.course._id),
          progressPct: enrollment.progressPct ?? 0,
          lastLessonId: enrollment.lastLessonId ? String(enrollment.lastLessonId) : null,
          completedAt: enrollment.completedAt ?? null,
          certificateSerial: certificate?.serial ?? null,
          course: courseToDTO(enrollment.course),
          createdAt: enrollment.createdAt,
        };
      });

    return send(res, items);
  }),
);

router.get(
  '/courses/:courseId/progress',
  requireAuth,
  asyncHandler(async (req, res) => {
    const enrollment = await requireEnrollment(req.auth!.userId, String(req.params.courseId));
    const [lessons, progress] = await Promise.all([
      Lesson.find({ course: String(req.params.courseId) }).select('_id').lean(),
      LessonProgress.find({ student: req.auth!.userId, course: String(req.params.courseId) }).lean(),
    ]);
    const completed = progress.filter((p: any) => p.completed).length;
    const certificate = enrollment.certificateId
      ? await Certificate.findById(enrollment.certificateId).lean()
      : null;

    return send(res, {
      courseId: String(req.params.courseId),
      progressPct: lessons.length ? Math.round((completed / lessons.length) * 100) : 0,
      lessons: progress.map((p: any) => ({
        lessonId: String(p.lesson),
        watchedSeconds: p.watchedSeconds ?? 0,
        completed: !!p.completed,
      })),
      completedAt: enrollment.completedAt ?? null,
      certificateSerial: certificate?.serial ?? null,
      totalLessons: lessons.length,
      completedLessons: completed,
      lastLessonId: enrollment.lastLessonId ? String(enrollment.lastLessonId) : null,
    });
  }),
);

router.patch(
  '/progress/:lessonId',
  requireAuth,
  validateProgress(),
  asyncHandler(async (req, res) => {
    const lesson = await Lesson.findById(String(req.params.lessonId)).lean();
    if (!lesson) throw notFound('Lesson not found');
    await requireEnrollment(req.auth!.userId, String(lesson.course));

    let durationSec = lesson.durationSec ?? 0;
    if (lesson.type === 'video') {
      const video = await VideoAsset.findOne({ lesson: lesson._id }).lean();
      durationSec = video?.durationSec ?? durationSec;
    }

    await upsertLessonProgress({
      studentId: req.auth!.userId,
      courseId: String(lesson.course),
      lessonId: String(lesson._id),
      watchedSeconds: req.body.watchedSeconds,
      durationSec,
      type: lesson.type,
      explicit: req.body.completed,
    });

    const result = await recomputeCourseProgress(req.auth!.userId, String(lesson.course));
    return send(res, {
      lessonId: String(lesson._id),
      ...result,
    });
  }),
);

function validateProgress() {
  return (req: any, _res: any, next: any) => {
    const parsed = progressInputSchema.safeParse(req.body);
    if (!parsed.success) return next(badRequest('Progress payload is invalid'));
    req.body = parsed.data;
    next();
  };
}

/* ─────────────────────────────  Quizzes  ────────────────────────────── */

router.post(
  '/courses/:courseId/lessons/:lessonId/quiz',
  requireAuth,
  asyncHandler(async (req, res, next) => {
    try {
      if (!['instructor', 'admin'].includes(req.auth!.role)) throw forbidden('Instructors only');
      const course = await ownedCourse(req);
      const lesson = await Lesson.findOne({ _id: String(req.params.lessonId), course: course._id });
      if (!lesson) throw notFound('Lesson not found');

      const parsed = quizInputSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues[0]?.message ?? 'Quiz is invalid', parsed.error.issues);
      }

      const payload = {
        course: course._id,
        lesson: lesson._id,
        instructor: req.auth!.userId,
        title: parsed.data.title,
        passingScore: parsed.data.passingScore,
        attemptsAllowed: parsed.data.attemptsAllowed,
        timeLimitSec: parsed.data.timeLimitSec,
        questions: parsed.data.questions,
      };

      const quiz = await Quiz.findOneAndUpdate(
        { lesson: lesson._id },
        { $set: payload },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      await Lesson.updateOne(
        { _id: lesson._id },
        { $set: { quiz: quiz._id, type: 'quiz' } },
      );

      return send(res, { quizId: String(quiz._id) }, 201);
    } catch (error) {
      return next(error);
    }
  }),
);

router.get(
  '/quizzes/:quizId/manage',
  requireAuth,
  asyncHandler(async (req, res) => {
    const quiz = await Quiz.findById(String(req.params.quizId)).lean();
    if (!quiz) throw notFound('Quiz not found');
    if (String(quiz.instructor) !== req.auth!.userId && req.auth!.role !== 'admin') {
      throw forbidden('Instructors only');
    }
    return send(res, quiz);
  }),
);

router.delete(
  '/quizzes/:quizId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const quiz = await Quiz.findById(String(req.params.quizId)).lean();
    if (!quiz) throw notFound('Quiz not found');
    if (String(quiz.instructor) !== req.auth!.userId && req.auth!.role !== 'admin') {
      throw forbidden('Instructors only');
    }
    await Quiz.deleteOne({ _id: quiz._id });
    await Lesson.updateOne({ _id: quiz.lesson }, { $set: { quiz: null } });
    await QuizAttempt.deleteMany({ quiz: quiz._id });
    return send(res, { deleted: true });
  }),
);

router.get(
  '/quizzes/:quizId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const quiz = await Quiz.findById(String(req.params.quizId)).lean();
    if (!quiz) throw notFound('Quiz not found');

    const isOwner = String(quiz.instructor) === req.auth!.userId || req.auth!.role === 'admin';
    if (!isOwner) await requireEnrollment(req.auth!.userId, String(quiz.course));

    const attempts = await QuizAttempt.find({ quiz: quiz._id, student: req.auth!.userId })
      .sort({ submittedAt: -1 })
      .lean();
    const best = attempts.reduce((max, attempt: any) => Math.max(max, attempt.score ?? 0), 0);

    return send(res, {
      id: String(quiz._id),
      courseId: String(quiz.course),
      lessonId: quiz.lesson ? String(quiz.lesson) : null,
      title: quiz.title,
      passingScore: quiz.passingScore,
      attemptsAllowed: quiz.attemptsAllowed,
      timeLimitSec: quiz.timeLimitSec,
      questions: quiz.questions.map((question: any, index: number) => ({
        id: String(question._id ?? index),
        prompt: question.prompt,
        type: question.type,
        options: question.options,
        points: question.points,
      })),
      attemptsUsed: attempts.length,
      bestScore: attempts.length ? best : null,
      lastAttemptId: attempts[0] ? String((attempts[0] as any)._id) : null,
    });
  }),
);

router.post(
  '/quizzes/:quizId/attempts',
  requireAuth,
  asyncHandler(async (req, res) => {
    const quiz = await Quiz.findById(String(req.params.quizId)).lean();
    if (!quiz) throw notFound('Quiz not found');
    await requireEnrollment(req.auth!.userId, String(quiz.course));

    const used = await QuizAttempt.countDocuments({ quiz: quiz._id, student: req.auth!.userId });
    if (used >= quiz.attemptsAllowed) {
      throw badRequest(`You have used all ${quiz.attemptsAllowed} attempts for this quiz`);
    }

    const attempt = await QuizAttempt.create({
      quiz: quiz._id,
      student: req.auth!.userId,
      course: quiz.course,
      answers: [],
      startedAt: new Date(),
      submittedAt: new Date(),
    });

    return send(
      res,
      {
        attemptId: String(attempt._id),
        startedAt: (attempt as any).startedAt,
        expiresAt: quiz.timeLimitSec ? new Date(Date.now() + quiz.timeLimitSec * 1000) : null,
        attemptNumber: used + 1,
        attemptsAllowed: quiz.attemptsAllowed,
      },
      201,
    );
  }),
);

router.patch(
  '/attempts/:attemptId/submit',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = quizSubmitSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Answers are invalid');

    const attempt = await QuizAttempt.findById(String(req.params.attemptId));
    if (!attempt) throw notFound('Attempt not found');
    if (String(attempt.student) !== req.auth!.userId) throw forbidden('This attempt is not yours');
    if ((attempt.answers as any[]).length) throw badRequest('This attempt was already submitted');

    const quiz = await Quiz.findById(attempt.quiz).lean();
    if (!quiz) throw notFound('Quiz not found');

    if (quiz.timeLimitSec) {
      const elapsed = (Date.now() - new Date(attempt.startedAt as any).getTime()) / 1000;
      if (elapsed > quiz.timeLimitSec + 15) {
        throw badRequest('Time is up — this attempt was not accepted');
      }
    }

    const { score, earned, maxScore, breakdown } = gradeQuiz(
      quiz.questions as any,
      parsed.data.answers,
    );
    const passed = score >= quiz.passingScore;

    attempt.answers = breakdown.map((item) => ({
      questionId: item.questionId,
      selected: parsed.data.answers.find((a) => a.questionId === item.questionId)?.selected ?? [],
      correct: item.correct,
      earned: item.earned,
    })) as any;
    attempt.score = score as any;
    attempt.maxScore = maxScore as any;
    attempt.passed = passed as any;
    attempt.submittedAt = new Date() as any;
    await attempt.save();

    if (passed && quiz.lesson) {
      const lesson = await Lesson.findById(quiz.lesson).lean();
      if (lesson) {
        await upsertLessonProgress({
          studentId: req.auth!.userId,
          courseId: String(lesson.course),
          lessonId: String(lesson._id),
          watchedSeconds: lesson.durationSec ?? 0,
          durationSec: lesson.durationSec ?? 0,
          type: 'quiz',
          explicit: true,
        });
        await recomputeCourseProgress(req.auth!.userId, String(lesson.course));
      }
    }

    return send(res, {
      attemptId: String(attempt._id),
      score,
      maxScore,
      passed,
      earned,
      passingScore: quiz.passingScore,
      breakdown,
    });
  }),
);

router.get(
  '/me/attempts',
  requireAuth,
  asyncHandler(async (req, res) => {
    const attempts = await QuizAttempt.find({ student: req.auth!.userId })
      .sort({ submittedAt: -1 })
      .populate('quiz', 'title passingScore')
      .populate('course', 'title slug')
      .limit(100)
      .lean();
    return send(res, attempts);
  }),
);

/* ───────────────────────────  Certificates  ────────────────────────── */

router.post(
  '/certificates/issue',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { courseId } = req.body as { courseId?: string };
    if (!courseId) throw badRequest('courseId is required');
    const enrollment = await requireEnrollment(req.auth!.userId, courseId);
    if ((enrollment.progressPct ?? 0) < 100) {
      throw badRequest('Finish every lesson before claiming your certificate');
    }
    const certificate = await issueCertificate(req.auth!.userId, courseId);
    await Enrollment.updateOne(
      { _id: enrollment._id },
      { $set: { certificateId: (certificate as any)._id, completedAt: enrollment.completedAt ?? new Date() } },
    );
    return send(res, certificateToDTO(certificate), 201);
  }),
);

router.get(
  '/me/certificates',
  requireAuth,
  asyncHandler(async (req, res) => {
    const certificates = await Certificate.find({ student: req.auth!.userId })
      .sort({ issuedAt: -1 })
      .lean();
    return send(res, certificates.map(certificateToDTO));
  }),
);

router.get(
  '/certificates/:serial/download',
  requireAuth,
  asyncHandler(async (req, res) => {
    const certificate = await Certificate.findOne({ serial: String(req.params.serial) }).lean();
    if (!certificate) throw notFound('Certificate not found');
    if (String(certificate.student) !== req.auth!.userId && req.auth!.role !== 'admin') {
      throw forbidden('This certificate belongs to another learner');
    }

    if (isS3Enabled()) return res.redirect(certificateUrl(certificate.serial));

    const file = certificateFile(certificate.serial);
    if (!fs.existsSync(file)) throw notFound('Certificate file is not available');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="lumen-${certificate.serial}.pdf"`);
    return res.sendFile(file);
  }),
);

router.get(
  '/verify/:serial',
  asyncHandler(async (req, res) => {
    const certificate = await Certificate.findOne({ serial: String(req.params.serial) }).lean();
    if (!certificate) throw notFound('No certificate matches that serial');
    return send(res, {
      ...certificateToDTO(certificate),
      valid: true,
      issuer: 'Lumen Academy',
    });
  }),
);

export default router;
