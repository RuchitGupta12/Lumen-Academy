import { Router } from 'express';
import { Course } from '../models/course';
import { Enrollment } from '../models/learning';
import { LedgerEntry, Order } from '../models/commerce';
import { Quiz, QuizAttempt } from '../models/assessment';
import { asyncHandler, forbidden, notFound, send } from '../lib/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { instructorRevenue } from '../services/payments';

const router = Router();
router.use(requireAuth, requireRole('instructor', 'admin'));

const money = (cents: number) => (cents / 100).toFixed(2);

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const instructorId = req.auth!.userId;
    const range = String(req.query.range ?? '6m');
    const months = range === '12m' ? 12 : range === 'all' ? 0 : 6;

    const courses = await Course.find({ instructor: instructorId }).lean();
    const courseIds = courses.map((course) => course._id);

    const [ledger, students, monthly, recentOrders, ratings] = await Promise.all([
      LedgerEntry.find({ instructor: instructorId }).lean(),
      Enrollment.distinct('student', { course: { $in: courseIds } }),
      instructorRevenue(instructorId, months),
      Order.find({ instructor: instructorId })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('course', 'title slug')
        .populate('student', 'name email')
        .lean(),
      Course.aggregate([
        { $match: { instructor: new (require('mongoose').Types.ObjectId)(instructorId) } },
        {
          $group: {
            _id: null,
            ratingAvg: { $avg: '$stats.ratingAvg' },
            ratingCount: { $sum: '$stats.ratingCount' },
          },
        },
      ]),
    ]);

    const totals = ledger.reduce(
      (acc, entry: any) => {
        if (entry.status === 'reversed') {
          acc.refunds += entry.gross;
          acc.gross -= entry.gross;
          acc.fees -= entry.fee;
          acc.net -= entry.net;
        } else {
          acc.gross += entry.gross;
          acc.fees += entry.fee;
          acc.net += entry.net;
        }
        return acc;
      },
      { gross: 0, fees: 0, net: 0, refunds: 0 },
    );

    const enrollmentsByCourse = await Enrollment.aggregate([
      { $match: { course: { $in: courseIds } } },
      { $group: { _id: '$course', students: { $sum: 1 } } },
    ]);
    const revenueByCourse = await LedgerEntry.aggregate([
      { $match: { instructor: new (require('mongoose').Types.ObjectId)(instructorId), status: 'available' } },
      { $group: { _id: '$course', revenue: { $sum: '$net' }, gross: { $sum: '$gross' } } },
    ]);

    const topCourses = courses
      .map((course: any) => {
        const enrollment = enrollmentsByCourse.find((row: any) => String(row._id) === String(course._id));
        const revenue = revenueByCourse.find((row: any) => String(row._id) === String(course._id));
        return {
          id: String(course._id),
          title: course.title,
          slug: course.slug,
          status: course.status,
          students: enrollment?.students ?? 0,
          revenue: revenue?.revenue ?? 0,
          gross: revenue?.gross ?? 0,
          ratingAvg: course.stats?.ratingAvg ?? 0,
          enrollmentCount: course.stats?.enrollmentCount ?? 0,
        };
      })
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 6);

    return send(res, {
      totals: {
        ...totals,
        students: students.length,
        courses: courses.length,
        ratingAvg: Math.round(((ratings[0]?.ratingAvg ?? 0) as number) * 10) / 10,
        ratingCount: (ratings[0]?.ratingCount ?? 0) as number,
      },
      monthly,
      topCourses,
      recentOrders: recentOrders.map((order: any) => ({
        id: String(order._id),
        courseId: String(order.course?._id ?? order.course),
        courseTitle: order.course?.title ?? 'Course',
        studentName: order.student?.name ?? 'Learner',
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        provider: order.provider,
        createdAt: order.createdAt,
      })),
      range,
    });
  }),
);

router.get(
  '/courses',
  asyncHandler(async (req, res) => {
    const courses = await Course.find({ instructor: req.auth!.userId }).sort({ updatedAt: -1 }).lean();
    const ids = courses.map((course) => course._id);
    const [enrollments, revenue] = await Promise.all([
      Enrollment.aggregate([
        { $match: { course: { $in: ids } } },
        { $group: { _id: '$course', students: { $sum: 1 } } },
      ]),
      LedgerEntry.aggregate([
        { $match: { instructor: new (require('mongoose').Types.ObjectId)(req.auth!.userId), status: 'available' } },
        { $group: { _id: '$course', revenue: { $sum: '$net' } } },
      ]),
    ]);

    return send(
      res,
      courses.map((course: any) => ({
        id: String(course._id),
        title: course.title,
        slug: course.slug,
        status: course.status,
        price: course.price,
        category: course.category,
        lessons: course.stats?.lessonCount ?? 0,
        students: enrollments.find((row: any) => String(row._id) === String(course._id))?.students ?? 0,
        revenue: revenue.find((row: any) => String(row._id) === String(course._id))?.revenue ?? 0,
        ratingAvg: course.stats?.ratingAvg ?? 0,
        updatedAt: course.updatedAt,
        cover: course.cover,
      })),
    );
  }),
);

router.get(
  '/revenue',
  asyncHandler(async (req, res) => {
    const months = Number(req.query.months ?? 6);
    const monthly = await instructorRevenue(req.auth!.userId, Number.isFinite(months) ? months : 6);
    return send(res, monthly);
  }),
);

router.get(
  '/revenue.csv',
  asyncHandler(async (req, res) => {
    const entries = await LedgerEntry.find({ instructor: req.auth!.userId })
      .sort({ availableAt: -1 })
      .populate('course', 'title')
      .populate('student', 'name email')
      .lean();

    const header = 'order_id,course,student,status,gross_usd,platform_fee_usd,net_usd,available_at';
    const rows = entries.map((entry: any) =>
      [
        String(entry.order),
        `"${(entry.course?.title ?? '').replace(/"/g, '""')}"`,
        `"${(entry.student?.name ?? '').replace(/"/g, '""')}"`,
        entry.status,
        money(entry.gross),
        money(entry.fee),
        money(entry.net),
        new Date(entry.availableAt).toISOString(),
      ].join(','),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lumen-revenue.csv"');
    return res.send([header, ...rows].join('\n'));
  }),
);

router.get(
  '/payouts',
  asyncHandler(async (req, res) => {
    const entries = await LedgerEntry.find({ instructor: req.auth!.userId, status: 'available' })
      .sort({ availableAt: -1 })
      .limit(200)
      .populate('course', 'title')
      .lean();

    const byMonth = new Map<string, { month: string; gross: number; fee: number; net: number; orders: number }>();
    for (const entry of entries as any[]) {
      const month = new Date(entry.availableAt).toISOString().slice(0, 7);
      const bucket = byMonth.get(month) ?? { month, gross: 0, fee: 0, net: 0, orders: 0 };
      bucket.gross += entry.gross;
      bucket.fee += entry.fee;
      bucket.net += entry.net;
      bucket.orders += 1;
      byMonth.set(month, bucket);
    }

    return send(
      res,
      [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month)),
    );
  }),
);

router.get(
  '/students',
  asyncHandler(async (req, res) => {
    const courses = await Course.find({ instructor: req.auth!.userId }).select('_id title').lean();
    const courseIds = courses.map((course) => course._id);
    const enrollments = await Enrollment.find({ course: { $in: courseIds } })
      .sort({ createdAt: -1 })
      .populate('student', 'name email avatarUrl createdAt')
      .populate('course', 'title')
      .limit(300)
      .lean();

    return send(
      res,
      enrollments.map((enrollment: any) => ({
        id: String(enrollment._id),
        name: enrollment.student?.name ?? 'Learner',
        email: enrollment.student?.email ?? '',
        courseId: String(enrollment.course?._id ?? ''),
        courseTitle: enrollment.course?.title ?? '',
        progressPct: enrollment.progressPct ?? 0,
        completed: !!enrollment.completedAt,
        enrolledAt: enrollment.createdAt,
      })),
    );
  }),
);

router.get(
  '/quizzes/:quizId/analytics',
  asyncHandler(async (req, res) => {
    const quiz = await Quiz.findById(String(req.params.quizId)).lean();
    if (!quiz) throw notFound('Quiz not found');
    if (String(quiz.instructor) !== req.auth!.userId && req.auth!.role !== 'admin') {
      throw forbidden('This quiz belongs to another instructor');
    }

    const attempts = await QuizAttempt.find({ quiz: quiz._id }).lean();
    const buckets = [0, 0, 0, 0, 0];
    for (const attempt of attempts as any[]) {
      const index = Math.min(4, Math.floor((attempt.score ?? 0) / 20));
      buckets[index] += 1;
    }

    const perQuestion = (quiz.questions as any[]).map((question) => {
      const relevant = (attempts as any[]).flatMap((attempt) =>
        (attempt.answers ?? []).filter((answer: any) => String(answer.questionId) === String(question._id)),
      );
      const answered = relevant.length;
      const correct = relevant.filter((answer: any) => answer.correct).length;
      return {
        questionId: String(question._id),
        prompt: question.prompt,
        answered,
        correct,
        accuracy: answered ? Math.round((correct / answered) * 100) : 0,
      };
    });

    return send(res, {
      quizId: String(quiz._id),
      title: quiz.title,
      attempts: attempts.length,
      passRate: attempts.length
        ? Math.round(((attempts as any[]).filter((a) => a.passed).length / attempts.length) * 100)
        : 0,
      averageScore: attempts.length
        ? Math.round(
            ((attempts as any[]).reduce((sum, a) => sum + (a.score ?? 0), 0) / attempts.length) * 10,
          ) / 10
        : 0,
      distribution: buckets.map((count, index) => ({ bucket: `${index * 20}-${index * 20 + 20}`, count })),
      perQuestion,
    });
  }),
);

export default router;
