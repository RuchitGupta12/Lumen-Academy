/**
 * End-to-end API tests.
 *
 * Boots an isolated in-memory MongoDB on a random port, points the app at it
 * via MONGODB_URI *before* importing any app module, and exercises every
 * feature slice through Supertest. No external Mongo, Redis or FFmpeg needed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import type { Server } from 'node:http';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const PASSWORD = 'Password123!';
const TEST_MEDIA = path.join(os.tmpdir(), 'lumen-api-tests-media');

let mongod: MongoMemoryServer;
let app: Express;
let server: Server;
let base: string;

// Fixtures captured during setup.
let studentToken: string;
let studentId: string;
let buyerToken: string;
let instructorToken: string;
let instructorId: string;
let adminToken: string;
let courseId: string;
let courseSlug: string;
let videoLessonId: string;
let quizLessonId: string;
let quizId: string;
let certificateSerial: string;

type ApiResult = {
  status: number;
  body: any;
  headers: Record<string, string | string[] | undefined>;
};

async function api(
  method: 'get' | 'post' | 'patch' | 'put' | 'delete',
  route: string,
  options: { token?: string; body?: unknown; cookie?: string } = {},
): Promise<ApiResult> {
  const response = await fetch(`${base}${route}`, {
    method: method.toUpperCase(),
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: Object.fromEntries(response.headers.entries()) };
}

const data = (result: ApiResult) => result.body?.data;

/** Register through the real API and return the access token + user id. */
async function register(name: string, email: string, role: 'student' | 'instructor' = 'student') {
  const result = await api('post', '/api/v1/auth/register', { body: { name, email, password: PASSWORD, role } });
  expect(result.status).toBe(201);
  return { token: data(result).accessToken as string, id: data(result).user.id as string, cookie: result.headers['set-cookie'] };
}

beforeAll(async () => {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  mongod = await MongoMemoryServer.create();

  // env.ts reads process.env at import time — set these before importing the app.
  process.env.MONGODB_URI = mongod.getUri('lumen-tests');
  process.env.MEDIA_DRIVER = 'local';
  process.env.MEDIA_OPEN = 'false';
  process.env.MEDIA_ROOT = TEST_MEDIA;
  process.env.QUEUE_DRIVER = 'local';
  process.env.PAYMENTS_DRIVER = 'mock';
  process.env.LIVE_DRIVER = 'simulated';
  fs.mkdirSync(TEST_MEDIA, { recursive: true });

  const [{ createApp }, { connectDb }, bcrypt] = await Promise.all([
    import('../src/app'),
    import('../src/config/db'),
    import('bcryptjs'),
  ]);

  await connectDb();

  app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

  const { User } = await import('../src/models/user');
  const { Course } = await import('../src/models/course');
  const { Lesson } = await import('../src/models/lesson');
  const { VideoAsset } = await import('../src/models/video');
  const { Quiz } = await import('../src/models/assessment');
  const { Enrollment } = await import('../src/models/learning');

  // ── users ──────────────────────────────────────────────────────────────
  const student = await register('Ada Student', 'ada@tests.lumen');
  studentToken = student.token;
  studentId = student.id;

  const buyer = await register('Ben Buyer', 'ben@tests.lumen');
  buyerToken = buyer.token;
  let buyerUserId = buyer.id;

  const teacher = await register('Maya Teacher', 'maya@tests.lumen', 'instructor');
  instructorToken = teacher.token;
  instructorId = teacher.id;

  // Admins can't self-register — create directly.
  const passwordHash = await bcrypt.default.hash(PASSWORD, 10);
  const adminUser = await User.create({
    name: 'Ruth Admin',
    email: 'ruth@tests.lumen',
    passwordHash,
    role: 'admin',
  });
  const adminLogin = await api('post', '/api/v1/auth/login', {
    body: { email: 'ruth@tests.lumen', password: PASSWORD },
  });
  expect(adminLogin.status).toBe(200);
  adminToken = data(adminLogin).accessToken;
  void adminUser;

  // ── course, lessons, video, quiz ────────────────────────────────────────
  const sectionId = new (await import('mongoose')).Types.ObjectId();
  const course = await Course.create({
    title: 'Testing Distributed Systems',
    slug: 'testing-distributed-systems',
    subtitle: 'A hands-on course for the API test suite',
    description: 'Course used by the automated Supertest suite.',
    category: 'Development',
    level: 'intermediate',
    price: 4900,
    instructor: instructorId,
    status: 'published',
    publishedAt: new Date(),
    tags: ['testing', 'api'],
    sections: [{ _id: sectionId, title: 'Foundations', order: 0 }],
    stats: { lessonCount: 2, durationSec: 52 },
  });
  courseId = String(course._id);
  courseSlug = course.slug;

  const videoLesson = await Lesson.create({
    course: course._id,
    sectionId,
    title: 'Why tests matter',
    type: 'video',
    order: 0,
    durationSec: 26,
    isPreview: true,
  });
  videoLessonId = String(videoLesson._id);

  const videoAsset = await VideoAsset.create({
    course: course._id,
    lesson: videoLesson._id,
    instructor: instructorId,
    originalName: 'fixture.mp4',
    status: 'ready',
    progress: 100,
    durationSec: 26,
    manifestKey: `hls/${videoLesson._id}/master.m3u8`,
    renditions: [{ height: 360, width: 640, bitrateKbps: 700, playlist: `hls/${videoLesson._id}/360.m3u8` }],
    processedAt: new Date(),
  });
  await Lesson.updateOne({ _id: videoLesson._id }, { $set: { video: videoAsset._id } });

  const quiz = await Quiz.create({
    course: course._id,
    lesson: null,
    instructor: instructorId,
    title: 'Foundations check',
    passingScore: 50,
    attemptsAllowed: 3,
    questions: [
      {
        prompt: 'Does a passing test build confidence?',
        type: 'single',
        options: ['Yes', 'No'],
        correct: [0],
        points: 1,
        explanation: 'Automated checks make regressions visible early.',
      },
    ],
  });
  quizId = String(quiz._id);

  const quizLesson = await Lesson.create({
    course: course._id,
    sectionId,
    title: 'Knowledge check',
    type: 'quiz',
    order: 1,
    durationSec: 0,
    quiz: quiz._id,
  });
  quizLessonId = String(quizLesson._id);
  await Quiz.updateOne({ _id: quiz._id }, { $set: { lesson: quizLesson._id } });

  // The buyer has paid for the course, which unlocks direct enrolment.
  const { Order } = await import('../src/models/commerce');
  await Order.create({
    student: buyerUserId,
    course: course._id,
    instructor: instructorId,
    amount: 4900,
    currency: 'usd',
    provider: 'mock',
    status: 'paid',
    paidAt: new Date(),
  });

  await Enrollment.create({ student: studentId, course: course._id, pricePaid: 4900, progressPct: 0 });
}, 120_000);

afterAll(async () => {
  const mongoose = (await import('mongoose')).default;
  await mongoose.disconnect();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (mongod) await mongod.stop();
  fs.rmSync(TEST_MEDIA, { recursive: true, force: true });
});

/* ───────────────────────────────────────────────────────────────────────── */

describe('platform health', () => {
  it('reports service health and active drivers', async () => {
    const result = await api('get', '/health');
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(data(result).service).toBe('lumen-api');
    expect(data(result).drivers).toMatchObject({ media: 'local', queue: 'local', payments: 'mock', live: 'simulated' });
  });

  it('exposes public runtime config', async () => {
    const result = await api('get', '/api/v1/config');
    expect(result.status).toBe(200);
    expect(data(result)).toMatchObject({ payments: 'mock', live: 'simulated', platformFeePct: 20, completionThreshold: 90 });
  });
});

describe('authentication', () => {
  it('registers a new student and returns a bearer token', async () => {
    const result = await api('post', '/api/v1/auth/register', {
      body: { name: 'New Learner', email: 'new@tests.lumen', password: PASSWORD },
    });
    expect(result.status).toBe(201);
    expect(data(result).user.role).toBe('student');
    expect(data(result).accessToken).toBeTruthy();
  });

  it('rejects duplicate email registration', async () => {
    const result = await api('post', '/api/v1/auth/register', {
      body: { name: 'Duplicate', email: 'ada@tests.lumen', password: PASSWORD },
    });
    expect(result.status).toBe(409);
  });

  it('rejects a wrong password', async () => {
    const result = await api('post', '/api/v1/auth/login', {
      body: { email: 'ada@tests.lumen', password: 'wrong-password' },
    });
    expect(result.status).toBe(401);
  });

  it('returns the authenticated profile', async () => {
    const result = await api('get', '/api/v1/auth/me', { token: studentToken });
    expect(result.status).toBe(200);
    expect(data(result).email).toBe('ada@tests.lumen');
  });

  it('refreshes an access token from the refresh cookie', async () => {
    const login = await api('post', '/api/v1/auth/login', {
      body: { email: 'ada@tests.lumen', password: PASSWORD },
    });
    const rawCookie = login.headers['set-cookie'];
    const cookieString = Array.isArray(rawCookie) ? rawCookie[0] : String(rawCookie ?? '').split(',')[0];
    const cookie = cookieString.split(';')[0];
    expect(cookie).toBeTruthy();
    const result = await api('post', '/api/v1/auth/refresh', { cookie });
    expect(result.status).toBe(200);
    expect(data(result).accessToken).toBeTruthy();
  });
});

describe('catalog & courses', () => {
  it('lists published courses with pagination', async () => {
    const result = await api('get', '/api/v1/courses?page=1&pageSize=10');
    expect(result.status).toBe(200);
    expect(Array.isArray(data(result).items)).toBe(true);
    expect(data(result).items.length).toBeGreaterThan(0);
    expect(typeof data(result).total).toBe('number');
  });

  it('filters courses by category', async () => {
    const result = await api('get', '/api/v1/courses?category=Development');
    expect(result.status).toBe(200);
    expect(data(result).items.every((c: any) => c.category === 'Development')).toBe(true);
  });

  it('returns full course detail with serialised lessons', async () => {
    const result = await api('get', `/api/v1/courses/${courseSlug}`, { token: studentToken });
    expect(result.status).toBe(200);
    expect(data(result).id).toBe(courseId);
    expect(data(result).lessons).toHaveLength(2);
    expect(data(result).lessons[0].id).toBe(videoLessonId);
    expect(data(result).lessons[1].quizId).toBe(quizId);
    expect(data(result).lessons[0].video.hlsUrl).toContain('/media/hls/');
  });

  it('returns 404 for an unknown slug', async () => {
    const result = await api('get', '/api/v1/courses/not-a-real-course');
    expect(result.status).toBe(404);
  });
});

describe('enrolment & progress', () => {
  it('enrols the buyer on a course', async () => {
    const result = await api('post', '/api/v1/enrollments', { token: buyerToken, body: { courseId } });
    expect([200, 201]).toContain(result.status);
    expect(data(result).enrolled).toBe(true);
  });

  it('treats a duplicate enrolment as idempotent', async () => {
    const result = await api('post', '/api/v1/enrollments', { token: buyerToken, body: { courseId } });
    expect(result.status).toBe(200);
    expect(data(result).enrolled).toBe(true);
  });

  it('lists my enrolments', async () => {
    const result = await api('get', '/api/v1/me/enrollments', { token: buyerToken });
    expect(result.status).toBe(200);
    expect(data(result).some((e: any) => e.course.id === courseId)).toBe(true);
  });

  it('requires enrolment before reading progress', async () => {
    const result = await api('get', `/api/v1/courses/${courseId}/progress`, { token: buyerToken });
    expect(result.status).toBe(200);
    expect(data(result).progressPct).toBe(0);
  });

  it('updates lesson progress and reports a percentage', async () => {
    const result = await api('patch', `/api/v1/progress/${videoLessonId}`, {
      token: buyerToken,
      body: { watchedSeconds: 12, completed: true },
    });
    expect(result.status).toBe(200);
    expect(data(result).progressPct).toBe(50);
  });

  it('auto-issues a certificate at 100% completion', async () => {
    const quizProgress = await api('patch', `/api/v1/progress/${quizLessonId}`, {
      token: buyerToken,
      body: { watchedSeconds: 0, completed: true },
    });
    expect(quizProgress.status).toBe(200);
    expect(data(quizProgress).progressPct).toBe(100);
    expect(data(quizProgress).certificateSerial).toBeTruthy();
    certificateSerial = data(quizProgress).certificateSerial;
  });

  it('rejects progress writes without an enrolment', async () => {
    const result = await api('patch', `/api/v1/progress/${videoLessonId}`, {
      token: instructorToken,
      body: { watchedSeconds: 1 },
    });
    expect(result.status).toBe(403);
  });
});

describe('quizzes', () => {
  it('lets an enrolled learner read the quiz', async () => {
    const result = await api('get', `/api/v1/quizzes/${quizId}`, { token: studentToken });
    expect(result.status).toBe(200);
    expect(data(result).questions.length).toBe(1);
    expect(data(result).passingScore).toBe(50);
  });

  it('starts an attempt and grades a submission', async () => {
    const quiz = await api('get', `/api/v1/quizzes/${quizId}`, { token: studentToken });
    const questionId = data(quiz).questions[0].id;

    const started = await api('post', `/api/v1/quizzes/${quizId}/attempts`, { token: studentToken });
    expect([200, 201]).toContain(started.status);
    const attemptId = data(started).attemptId;
    expect(attemptId).toBeTruthy();

    const submitted = await api('patch', `/api/v1/attempts/${attemptId}/submit`, {
      token: studentToken,
      body: { answers: [{ questionId, selected: [0] }] },
    });
    expect(submitted.status).toBe(200);
    // Score is reported as a 0–100 percentage.
    expect(data(submitted).score).toBe(100);
    expect(data(submitted).passed).toBe(true);
  });

  it('lists my attempts', async () => {
    const result = await api('get', '/api/v1/me/attempts', { token: studentToken });
    expect(result.status).toBe(200);
    expect(data(result).length).toBeGreaterThan(0);
  });
});

describe('certificates', () => {
  it('downloads the certificate as a PDF', async () => {
    const result = await fetch(`${base}/api/v1/certificates/${certificateSerial}/download`, {
      headers: { authorization: `Bearer ${buyerToken}` },
    });
    expect(result.status).toBe(200);
    expect(result.headers.get('content-type')).toContain('application/pdf');
    const buffer = Buffer.from(await result.arrayBuffer());
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('verifies a certificate publicly by serial', async () => {
    const result = await api('get', `/api/v1/verify/${certificateSerial}`);
    expect(result.status).toBe(200);
    expect(data(result).valid).toBe(true);
    expect(data(result).studentName).toBe('Ben Buyer');
    expect(data(result).courseTitle).toBe('Testing Distributed Systems');
  });

  it('returns 404 for an unknown serial', async () => {
    const result = await api('get', '/api/v1/verify/NO-SUCH-SERIAL');
    expect(result.status).toBe(404);
  });
});

describe('media playback', () => {
  it('issues a signed playback ticket for a preview lesson', async () => {
    const result = await api('get', `/api/v1/media/playback/${videoLessonId}`, { token: studentToken });
    expect(result.status).toBe(200);
    expect(data(result).hlsUrl).toContain('/media/hls/');
    expect(data(result).authorization).toBe('local');
    expect(result.headers['set-cookie']).toBeTruthy();
  });

  it('denies playback of a non-preview lesson without enrolment', async () => {
    // Register a learner who is not enrolled and request the quiz lesson.
    const outsider = await register('Outside Learner', 'outsider@tests.lumen');
    const result = await api('get', `/api/v1/media/playback/${quizLessonId}`, { token: outsider.token });
    expect(result.status).toBe(403);
  });
});

describe('payments (mock driver)', () => {
  let orderId: string;

  it('creates a pending checkout order', async () => {
    const result = await api('post', '/api/v1/checkout', { token: buyerToken, body: { courseId } });
    // Buyer already owns the course via the enrolment fixture — use a fresh account.
    if (result.status === 409) {
      const fresh = await register('Fresh Buyer', 'fresh@tests.lumen');
      const checkout = await api('post', '/api/v1/checkout', { token: fresh.token, body: { courseId } });
      expect(checkout.status).toBe(200);
      expect(data(checkout).mode).toBe('mock');
      orderId = data(checkout).orderId;
      // Keep the token for the following tests by reassigning a module-level holder.
      paymentToken = fresh.token;
    } else {
      expect(result.status).toBe(200);
      orderId = data(result).orderId;
      paymentToken = buyerToken;
    }
    expect(orderId).toBeTruthy();
  });

  it('declines the decline test card', async () => {
    const result = await api('post', `/api/v1/orders/${orderId}/pay`, {
      token: paymentToken,
      body: { card: '4000000000000002' },
    });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it('accepts the success test card and grants enrolment', async () => {
    const result = await api('post', `/api/v1/orders/${orderId}/pay`, {
      token: paymentToken,
      body: { card: '4242424242424242' },
    });
    expect(result.status).toBe(200);
    expect(data(result).paid).toBe(true);

    const enrollments = await api('get', '/api/v1/me/enrollments', { token: paymentToken });
    expect(data(enrollments).some((e: any) => e.course.id === courseId)).toBe(true);
  });
});
let paymentToken = '';

describe('instructor analytics', () => {
  it('returns an instructor overview', async () => {
    const result = await api('get', '/api/v1/instructor/overview?range=6', { token: instructorToken });
    expect(result.status).toBe(200);
    expect(data(result).totals).toBeTruthy();
  });

  it('lists instructor courses', async () => {
    const result = await api('get', '/api/v1/instructor/courses', { token: instructorToken });
    expect(result.status).toBe(200);
    expect(data(result).some((c: any) => c.id === courseId)).toBe(true);
  });

  it('lists instructor students and payouts', async () => {
    const [students, payouts] = await Promise.all([
      api('get', '/api/v1/instructor/students', { token: instructorToken }),
      api('get', '/api/v1/instructor/payouts', { token: instructorToken }),
    ]);
    expect(students.status).toBe(200);
    expect(payouts.status).toBe(200);
  });
});

describe('live classes', () => {
  let sessionId: string;

  it('schedules a class on an owned course', async () => {
    const result = await api('post', '/api/v1/live', {
      token: instructorToken,
      body: {
        courseId,
        title: 'Automated office hours',
        description: 'A live session created by the test suite',
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });
    expect([200, 201]).toContain(result.status);
    expect(data(result).id).toBeTruthy();
    sessionId = data(result).id;
  });

  it('lists upcoming sessions', async () => {
    const result = await api('get', '/api/v1/live/upcoming', { token: instructorToken });
    expect(result.status).toBe(200);
    expect(data(result).some((s: any) => s.id === sessionId)).toBe(true);
  });

  it('issues a simulated live-room token', async () => {
    const result = await api('post', `/api/v1/live/${sessionId}/token`, { token: instructorToken });
    expect(result.status).toBe(200);
    expect(data(result).mode).toBe('simulated');
    expect(data(result).roomName).toBeTruthy();
  });

  it('starts and ends the class, writing system chat messages', async () => {
    const started = await api('patch', `/api/v1/live/${sessionId}/status`, {
      token: instructorToken,
      body: { status: 'live' },
    });
    expect(started.status).toBe(200);
    expect(data(started).status).toBe('live');

    const messages = await api('get', `/api/v1/live/${sessionId}/messages`, { token: instructorToken });
    expect(messages.status).toBe(200);
    expect(data(messages).some((m: any) => m.kind === 'system')).toBe(true);

    const ended = await api('patch', `/api/v1/live/${sessionId}/status`, {
      token: instructorToken,
      body: { status: 'ended' },
    });
    expect(ended.status).toBe(200);
    expect(data(ended).status).toBe('ended');
  });
});

describe('admin', () => {
  it('returns platform metrics', async () => {
    const result = await api('get', '/api/v1/admin/metrics', { token: adminToken });
    expect(result.status).toBe(200);
    expect(data(result).students).toBeGreaterThan(0);
    expect(data(result).courses).toBeGreaterThan(0);
  });

  it('lists users, courses and orders', async () => {
    const [users, courses, orders] = await Promise.all([
      api('get', '/api/v1/admin/users?page=1&pageSize=10', { token: adminToken }),
      api('get', '/api/v1/admin/courses', { token: adminToken }),
      api('get', '/api/v1/admin/orders', { token: adminToken }),
    ]);
    expect(users.status).toBe(200);
    expect(data(users).items.length).toBeGreaterThan(0);
    expect(courses.status).toBe(200);
    expect(orders.status).toBe(200);
  });

  it('blocks a student from the admin API', async () => {
    const result = await api('get', '/api/v1/admin/metrics', { token: studentToken });
    expect(result.status).toBe(403);
  });

  it('blocks an instructor from the admin API', async () => {
    const result = await api('get', '/api/v1/admin/metrics', { token: instructorToken });
    expect(result.status).toBe(403);
  });

  it('rejects anonymous access to protected routes', async () => {
    const result = await api('get', '/api/v1/me/enrollments');
    expect(result.status).toBe(401);
  });
});
