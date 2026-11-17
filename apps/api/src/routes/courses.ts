import { Router } from 'express';
import mongoose from 'mongoose';
import {
  courseInputSchema,
  lessonInputSchema,
  sectionInputSchema,
  slugify,
  COURSE_CATEGORIES,
} from '@lumen/shared';
import { Course } from '../models/course';
import { Lesson } from '../models/lesson';
import { VideoAsset } from '../models/video';
import { Quiz } from '../models/assessment';
import { Enrollment, LessonProgress } from '../models/learning';
import { LiveSession } from '../models/live';
import { asyncHandler, badRequest, forbidden, notFound, send } from '../lib/errors';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { courseToDTO, lessonToDTO, publicUser, videoToDTO } from '../lib/serialize';
import { recomputeCourseStats } from '../services/courseStats';
import { removeVideoFiles } from '../lib/media';
import { isStripeEnabled } from '../config/env';

const router = Router();

const PAGE_SIZE = 12;

const COVERS = [
  { from: '#2C3E50', to: '#0B0D11', motif: '⌘' },
  { from: '#7A3B22', to: '#160D08', motif: '◐' },
  { from: '#21443C', to: '#07100D', motif: '⌁' },
  { from: '#3A2C55', to: '#0C0A14', motif: '◇' },
  { from: '#5A3B12', to: '#120B03', motif: '✳' },
  { from: '#1E3A5F', to: '#070B12', motif: '≡' },
];

const isObjectId = (value: string) => mongoose.Types.ObjectId.isValid(value);

function pickCover(index: number) {
  return COVERS[index % COVERS.length];
}

async function uniqueSlug(title: string) {
  const base = slugify(title) || 'course';
  let candidate = base;
  let suffix = 2;
  while (await Course.exists({ slug: candidate })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function loadOwnedCourse(req: any) {
  const course = await Course.findById(String(req.params.courseId));
  if (!course) throw notFound('Course not found');
  const owner = String(course.instructor) === req.auth.userId;
  if (!owner && req.auth.role !== 'admin') throw forbidden('This course belongs to another instructor');
  return course;
}

function sortFor(sort: string): Record<string, 1 | -1> {
  switch (sort) {
    case 'newest':
      return { createdAt: -1 };
    case 'price_asc':
      return { price: 1 };
    case 'price_desc':
      return { price: -1 };
    case 'rating':
      return { 'stats.ratingAvg': -1, 'stats.ratingCount': -1 };
    case 'popular':
    default:
      return { 'stats.enrollmentCount': -1, createdAt: -1 };
  }
}

/* ─────────────────────────────  Catalog  ───────────────────────────── */

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const {
      q = '',
      category = '',
      level = '',
      price = '',
      sort = 'popular',
      page = '1',
      pageSize = String(PAGE_SIZE),
      mine = '',
      status = '',
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    const mineFlag = mine === '1' || mine === 'true';

    if (mineFlag) {
      if (!req.auth || !['instructor', 'admin'].includes(req.auth.role)) {
        throw forbidden('Instructor access required');
      }
      if (req.auth.role !== 'admin') filter.instructor = req.auth.userId;
      if (status) filter.status = status;
    } else {
      filter.status = 'published';
    }

    if (category) filter.category = category;
    if (level) filter.level = level;
    if (price === 'free') filter.price = 0;
    if (price === 'paid') filter.price = { $gt: 0 };

    if (q.trim()) {
      const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { subtitle: { $regex: safe, $options: 'i' } },
        { tags: { $regex: safe, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const size = Math.min(48, Math.max(1, Number.parseInt(pageSize, 10) || PAGE_SIZE));

    const [total, courses] = await Promise.all([
      Course.countDocuments(filter),
      Course.find(filter)
        .sort(sortFor(sort))
        .skip((pageNum - 1) * size)
        .limit(size)
        .populate('instructor', 'name headline avatarUrl')
        .lean(),
    ]);

    let enrolledIds: string[] = [];
    if (req.auth) {
      const enrollments = await Enrollment.find({
        student: req.auth.userId,
        course: { $in: courses.map((c) => c._id) },
      })
        .select('course')
        .lean();
      enrolledIds = enrollments.map((e: any) => String(e.course));
    }

    return send(res, {
      items: courses.map((course: any) =>
        courseToDTO(course, { isEnrolled: enrolledIds.includes(String(course._id)) }),
      ),
      page: pageNum,
      pageSize: size,
      total,
      totalPages: Math.max(1, Math.ceil(total / size)),
    });
  }),
);

router.get(
  '/filters',
  asyncHandler(async (_req, res) => {
    const categories = await Course.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return send(res, {
      categories: COURSE_CATEGORIES.map((name) => ({
        name,
        count: categories.find((c: any) => c._id === name)?.count ?? 0,
      })),
      levels: ['beginner', 'intermediate', 'advanced'],
    });
  }),
);

router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const key = String(req.params.slug);
    const course = await Course.findOne(isObjectId(String(key)) ? { _id: key } : { slug: key })
      .populate('instructor', 'name headline avatarUrl bio')
      .lean();
    if (!course) throw notFound('Course not found');

    const owner = req.auth && String((course as any).instructor?._id) === req.auth.userId;
    const isAdmin = req.auth?.role === 'admin';
    if (course.status !== 'published' && !owner && !isAdmin) {
      throw notFound('Course not found');
    }

    const isEnrolled = req.auth
      ? !!(await Enrollment.exists({ student: req.auth.userId, course: course._id }))
      : false;
    const canSeeAll = isEnrolled || owner || isAdmin;

    const lessons = await Lesson.find({ course: course._id }).sort({ order: 1 }).lean();
    const videos = await VideoAsset.find({
      lesson: { $in: lessons.filter((l) => l.type === 'video').map((l) => l._id) },
    }).lean();
    const videoByLesson = new Map(videos.map((v: any) => [String(v.lesson), v]));

    const visibleLessons = lessons.map((lesson: any) => {
      const video = videoByLesson.get(String(lesson._id));
      const allow = canSeeAll || lesson.isPreview;
      return lessonToDTO(lesson, allow ? video : null);
    });

    return send(res, courseToDTO(course, { lessons: visibleLessons, isEnrolled }));
  }),
);

/* ─────────────────────────────  Authoring  ──────────────────────────── */

router.post(
  '/',
  requireAuth,
  requireRole('instructor', 'admin'),
  validate(courseInputSchema),
  asyncHandler(async (req, res) => {
    const body = req.body;
    const count = await Course.countDocuments({ instructor: req.auth!.userId });
    const course = await Course.create({
      ...body,
      slug: await uniqueSlug(body.title),
      instructor: req.auth!.userId,
      status: 'draft',
      cover: body.cover ?? pickCover(count),
    });
    const populated = await Course.findById(course._id)
      .populate('instructor', 'name headline avatarUrl')
      .lean();
    return send(res, courseToDTO(populated), 201);
  }),
);

router.patch(
  '/:courseId',
  requireAuth,
  requireRole('instructor', 'admin'),
  validate(courseInputSchema.partial()),
  asyncHandler(async (req, res) => {
    const course = await loadOwnedCourse(req);
    Object.assign(course, req.body);
    await course.save();
    const populated = await Course.findById(course._id)
      .populate('instructor', 'name headline avatarUrl')
      .lean();
    return send(res, courseToDTO(populated));
  }),
);

router.delete(
  '/:courseId',
  requireAuth,
  requireRole('instructor', 'admin'),
  asyncHandler(async (req, res) => {
    const course = await loadOwnedCourse(req);
    const lessons = await Lesson.find({ course: course._id }).lean();
    const videos = await VideoAsset.find({ course: course._id }).lean();

    await Promise.all([
      Lesson.deleteMany({ course: course._id }),
      Quiz.deleteMany({ course: course._id }),
      VideoAsset.deleteMany({ course: course._id }),
      Enrollment.deleteMany({ course: course._id }),
      LessonProgress.deleteMany({ course: course._id }),
      LiveSession.deleteMany({ course: course._id }),
    ]);
    for (const video of videos) removeVideoFiles(String(video._id));
    await Course.deleteOne({ _id: course._id });

    return send(res, { deleted: true, lessons: lessons.length });
  }),
);

router.post(
  '/:courseId/publish',
  requireAuth,
  requireRole('instructor', 'admin'),
  asyncHandler(async (req, res) => {
    const course = await loadOwnedCourse(req);
    const lessons = await Lesson.find({ course: course._id }).lean();
    if (!course.sections.length) throw badRequest('Add at least one section before publishing');
    if (!lessons.length) throw badRequest('Add at least one lesson before publishing');
    if (!course.description || course.description.length < 40) {
      throw badRequest('Write at least 40 characters of course description');
    }
    course.status = 'published' as any;
    course.publishedAt = (course.publishedAt ?? new Date()) as any;
    await course.save();
    return send(res, { status: course.status });
  }),
);

router.post(
  '/:courseId/unpublish',
  requireAuth,
  requireRole('instructor', 'admin'),
  asyncHandler(async (req, res) => {
    const course = await loadOwnedCourse(req);
    course.status = 'draft' as any;
    await course.save();
    return send(res, { status: course.status });
  }),
);

router.get(
  '/:courseId/manage',
  requireAuth,
  requireRole('instructor', 'admin'),
  asyncHandler(async (req, res) => {
    const course = await loadOwnedCourse(req);
    const lessons = await Lesson.find({ course: course._id }).sort({ order: 1 }).lean();
    const videos = await VideoAsset.find({ course: course._id }).lean();
    const videoByLesson = new Map(videos.map((v: any) => [String(v.lesson), v]));
    const quizzes = await Quiz.find({ course: course._id }).select('title lesson').lean();

    const dto = courseToDTO(course.toObject(), {
      lessons: lessons.map((lesson: any) =>
        lessonToDTO(lesson, videoByLesson.get(String(lesson._id)) ?? null),
      ),
    });

    return send(res, {
      ...dto,
      paymentsMode: isStripeEnabled() ? 'stripe' : 'mock',
      quizCount: quizzes.length,
      students: await Enrollment.countDocuments({ course: course._id }),
    });
  }),
);

/* ─────────────────────────────  Curriculum  ─────────────────────────── */

router.post(
  '/:courseId/sections',
  requireAuth,
  requireRole('instructor', 'admin'),
  validate(sectionInputSchema),
  asyncHandler(async (req, res) => {
    const course = await loadOwnedCourse(req);
    course.sections.push({ title: req.body.title, order: course.sections.length } as any);
    await course.save();
    return send(res, courseToDTO(course.toObject()), 201);
  }),
);

router.patch(
  '/:courseId/sections/:sectionId',
  requireAuth,
  requireRole('instructor', 'admin'),
  validate(sectionInputSchema.partial()),
  asyncHandler(async (req, res) => {
    const course = await loadOwnedCourse(req);
    const section = course.sections.id(String(req.params.sectionId));
    if (!section) throw notFound('Section not found');
    if (req.body.title) section.title = req.body.title;
    await course.save();
    return send(res, courseToDTO(course.toObject()));
  }),
);

router.delete(
  '/:courseId/sections/:sectionId',
  requireAuth,
  requireRole('instructor', 'admin'),
  asyncHandler(async (req, res) => {
    const course = await loadOwnedCourse(req);
    const section = course.sections.id(String(req.params.sectionId));
    if (!section) throw notFound('Section not found');
    const lessons = await Lesson.find({ sectionId: section._id }).select('_id').lean();
    await Lesson.deleteMany({ sectionId: section._id });
    await VideoAsset.deleteMany({ lesson: { $in: lessons.map((l) => l._id) } });
    section.deleteOne();
    course.sections.forEach((s, index) => (s.order = index));
    await course.save();
    await recomputeCourseStats(String(course._id));
    return send(res, { deleted: true });
  }),
);

router.post(
  '/:courseId/sections/:sectionId/lessons',
  requireAuth,
  requireRole('instructor', 'admin'),
  validate(lessonInputSchema),
  asyncHandler(async (req, res) => {
    const course = await loadOwnedCourse(req);
    const section = course.sections.id(String(req.params.sectionId));
    if (!section) throw notFound('Section not found');

    const lessonCount = await Lesson.countDocuments({ course: course._id });
    const lesson = await Lesson.create({
      course: course._id,
      sectionId: section._id,
      title: req.body.title,
      type: req.body.type,
      body: req.body.body ?? '',
      isPreview: req.body.isPreview ?? false,
      durationSec: req.body.durationSec ?? 0,
      order: req.body.order ?? lessonCount,
    });
    await recomputeCourseStats(String(course._id));
    return send(res, lessonToDTO(lesson.toObject(), null), 201);
  }),
);

router.patch(
  '/:courseId/lessons/:lessonId',
  requireAuth,
  requireRole('instructor', 'admin'),
  validate(lessonInputSchema.partial()),
  asyncHandler(async (req, res) => {
    const course = await loadOwnedCourse(req);
    const lesson = await Lesson.findOneAndUpdate(
      { _id: String(req.params.lessonId), course: course._id },
      { $set: req.body },
      { new: true },
    );
    if (!lesson) throw notFound('Lesson not found');
    await recomputeCourseStats(String(course._id));
    const video = await VideoAsset.findOne({ lesson: lesson._id }).lean();
    return send(res, lessonToDTO(lesson.toObject(), video));
  }),
);

router.delete(
  '/:courseId/lessons/:lessonId',
  requireAuth,
  requireRole('instructor', 'admin'),
  asyncHandler(async (req, res) => {
    const course = await loadOwnedCourse(req);
    const lesson = await Lesson.findOneAndDelete({ _id: String(req.params.lessonId), course: course._id });
    if (!lesson) throw notFound('Lesson not found');
    const videos = await VideoAsset.find({ lesson: lesson._id }).lean();
    for (const video of videos) removeVideoFiles(String(video._id));
    await VideoAsset.deleteMany({ lesson: lesson._id });
    await Quiz.deleteMany({ lesson: lesson._id });
    await LessonProgress.deleteMany({ lesson: lesson._id });
    await recomputeCourseStats(String(course._id));
    return send(res, { deleted: true });
  }),
);

router.patch(
  '/:courseId/reorder',
  requireAuth,
  requireRole('instructor', 'admin'),
  asyncHandler(async (req, res) => {
    const course = await loadOwnedCourse(req);
    const { sections = [], lessons = [] } = req.body as {
      sections?: Array<{ id: string; order: number }>;
      lessons?: Array<{ id: string; sectionId: string; order: number }>;
    };

    for (const section of sections) {
      const doc = course.sections.id(section.id);
      if (doc) doc.order = section.order;
    }
    await course.save();

    await Promise.all(
      lessons.map((lesson) =>
        Lesson.updateOne(
          { _id: lesson.id, course: course._id },
          { $set: { sectionId: lesson.sectionId, order: lesson.order } },
        ),
      ),
    );

    return send(res, { reordered: true });
  }),
);

router.get(
  '/:courseId/students',
  requireAuth,
  requireRole('instructor', 'admin'),
  asyncHandler(async (req, res) => {
    const course = await loadOwnedCourse(req);
    const enrollments = await Enrollment.find({ course: course._id })
      .populate('student', 'name email avatarUrl createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return send(
      res,
      enrollments.map((enrollment: any) => ({
        id: String(enrollment._id),
        student: {
          ...publicUser(enrollment.student),
          email: enrollment.student?.email ?? '',
          joinedAt: enrollment.student?.createdAt ?? null,
        },
        progressPct: enrollment.progressPct ?? 0,
        completedAt: enrollment.completedAt ?? null,
        pricePaid: enrollment.pricePaid ?? 0,
        enrolledAt: enrollment.createdAt,
      })),
    );
  }),
);

export default router;
