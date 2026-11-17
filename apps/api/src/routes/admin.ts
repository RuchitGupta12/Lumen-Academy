import { Router } from 'express';
import { COURSE_STATUSES, ROLES } from '@lumen/shared';
import { User } from '../models/user';
import { Course } from '../models/course';
import { Certificate, Enrollment } from '../models/learning';
import { Order } from '../models/commerce';
import { asyncHandler, badRequest, notFound, send } from '../lib/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { userToDTO } from '../lib/serialize';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get(
  '/metrics',
  asyncHandler(async (_req, res) => {
    const [students, instructors, courses, published, pending, enrollments, certificates, paid] =
      await Promise.all([
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: 'instructor' }),
        Course.countDocuments(),
        Course.countDocuments({ status: 'published' }),
        Course.countDocuments({ status: 'in_review' }),
        Enrollment.countDocuments(),
        Certificate.countDocuments(),
        Order.find({ status: 'paid' }).select('amount').lean(),
      ]);

    return send(res, {
      students,
      instructors,
      courses,
      published,
      pending,
      enrollments,
      certificates,
      gross: paid.reduce((sum, order: any) => sum + (order.amount ?? 0), 0),
    });
  }),
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { q = '', role = '', page = '1', pageSize = '20' } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (role && ROLES.includes(role as any)) filter.role = role;
    if (q.trim()) {
      const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
      ];
    }
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 20));

    const [total, users, enrollments] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * size)
        .limit(size)
        .lean(),
      Enrollment.aggregate([
        { $group: { _id: '$student', courseCount: { $sum: 1 } } },
      ]),
    ]);

    return send(res, {
      items: users.map((user: any) => ({
        ...userToDTO(user),
        courseCount: enrollments.find((row: any) => String(row._id) === String(user._id))?.courseCount ?? 0,
        lastLoginAt: user.lastLoginAt ?? null,
      })),
      page: pageNum,
      pageSize: size,
      total,
      totalPages: Math.max(1, Math.ceil(total / size)),
    });
  }),
);

router.patch(
  '/users/:userId',
  asyncHandler(async (req, res) => {
    const { role, status } = req.body as { role?: string; status?: string };
    if (role && !ROLES.includes(role as any)) throw badRequest('Unknown role');
    if (status && !['active', 'suspended'].includes(status)) throw badRequest('Unknown status');
    if (role === 'admin') throw badRequest('Admin accounts are provisioned from the seed script');

    const user = await User.findByIdAndUpdate(
      String(req.params.userId),
      { $set: { ...(role ? { role } : {}), ...(status ? { status } : {}) } },
      { new: true },
    ).lean();
    if (!user) throw notFound('User not found');
    return send(res, userToDTO(user));
  }),
);

router.get(
  '/courses',
  asyncHandler(async (req, res) => {
    const { status = '', q = '' } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (status && COURSE_STATUSES.includes(status as any)) filter.status = status;
    if (q.trim()) {
      const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: safe, $options: 'i' };
    }

    const courses = await Course.find(filter)
      .sort({ updatedAt: -1 })
      .populate('instructor', 'name email')
      .limit(100)
      .lean();

    return send(
      res,
      courses.map((course: any) => ({
        id: String(course._id),
        title: course.title,
        slug: course.slug,
        status: course.status,
        category: course.category,
        price: course.price,
        instructorName: course.instructor?.name ?? '—',
        instructorEmail: course.instructor?.email ?? '',
        lessons: course.stats?.lessonCount ?? 0,
        enrollments: course.stats?.enrollmentCount ?? 0,
        updatedAt: course.updatedAt,
      })),
    );
  }),
);

router.patch(
  '/courses/:courseId/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status?: string };
    if (!status || !COURSE_STATUSES.includes(status as any)) throw badRequest('Unknown status');
    const course = await Course.findByIdAndUpdate(
      String(req.params.courseId),
      { $set: { status, ...(status === 'published' ? { publishedAt: new Date() } : {}) } },
      { new: true },
    ).lean();
    if (!course) throw notFound('Course not found');
    return send(res, { id: String(course._id), status: course.status });
  }),
);

router.get(
  '/orders',
  asyncHandler(async (_req, res) => {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(60)
      .populate('course', 'title')
      .populate('student', 'name email')
      .lean();
    return send(
      res,
      orders.map((order: any) => ({
        id: String(order._id),
        courseTitle: order.course?.title ?? '—',
        studentName: order.student?.name ?? '—',
        amount: order.amount,
        status: order.status,
        provider: order.provider,
        createdAt: order.createdAt,
      })),
    );
  }),
);

export default router;
