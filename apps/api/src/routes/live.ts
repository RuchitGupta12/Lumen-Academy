import { Router } from 'express';
import { liveInputSchema } from '@lumen/shared';
import { Course } from '../models/course';
import { Enrollment } from '../models/learning';
import { ChatMessage, LiveSession } from '../models/live';
import { asyncHandler, badRequest, forbidden, notFound, send } from '../lib/errors';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth';
import { liveToDTO } from '../lib/serialize';
import { createLiveToken, ensureLivekitRoom, liveMode } from '../services/livekit';
import { emitTo } from '../realtime/io';

const router = Router();

async function sessionAccess(sessionId: string, userId: string, role: string) {
  const session = await LiveSession.findById(sessionId)
    .populate('course', 'title slug instructor')
    .populate('instructor', 'name')
    .lean();
  if (!session) throw notFound('Live session not found');
  const isHost =
    role === 'admin' ||
    String((session.instructor as any)?._id ?? session.instructor) === userId;
  const enrolled = await Enrollment.exists({ student: userId, course: (session.course as any)._id });
  if (!isHost && !enrolled) throw forbidden('Enrol in this course to join the class');
  return { session, isHost, enrolled: !!enrolled };
}

router.post(
  '/',
  requireAuth,
  requireRole('instructor', 'admin'),
  asyncHandler(async (req, res) => {
    const parsed = liveInputSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid session');

    const course = await Course.findById(parsed.data.courseId).lean();
    if (!course) throw notFound('Course not found');
    if (String(course.instructor) !== req.auth!.userId && req.auth!.role !== 'admin') {
      throw forbidden('You can only schedule classes for your own courses');
    }

    const session = await LiveSession.create({
      course: course._id,
      instructor: course.instructor,
      title: parsed.data.title,
      description: parsed.data.description,
      scheduledAt: new Date(parsed.data.scheduledAt),
      roomName: `lumen-${String(course._id).slice(-6)}-${Date.now().toString(36)}`,
      status: 'scheduled',
    });
    await ensureLivekitRoom(session.roomName);

    const populated = await LiveSession.findById(session._id)
      .populate('course', 'title slug')
      .populate('instructor', 'name')
      .lean();
    return send(res, liveToDTO(populated), 201);
  }),
);

router.get(
  '/upcoming',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [enrollments, teaching] = await Promise.all([
      Enrollment.find({ student: req.auth!.userId }).select('course').lean(),
      Course.find({ instructor: req.auth!.userId }).select('_id').lean(),
    ]);
    const courseIds = [
      ...enrollments.map((e: any) => e.course),
      ...teaching.map((c: any) => c._id),
    ];
    const sessions = await LiveSession.find({ course: { $in: courseIds } })
      .sort({ scheduledAt: -1 })
      .limit(30)
      .populate('course', 'title slug')
      .populate('instructor', 'name')
      .lean();

    return send(
      res,
      sessions.map((session: any) => ({
        ...liveToDTO(session),
        isHost: String(session.instructor?._id ?? session.instructor) === req.auth!.userId,
      })),
    );
  }),
);

router.get(
  '/course/:courseId',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const sessions = await LiveSession.find({ course: String(req.params.courseId) })
      .sort({ scheduledAt: 1 })
      .populate('course', 'title slug')
      .populate('instructor', 'name')
      .lean();
    const enrolled = req.auth
      ? !!(await Enrollment.exists({ student: req.auth.userId, course: String(req.params.courseId) }))
      : false;
    return send(
      res,
      sessions.map((session: any) => ({
        ...liveToDTO(session),
        isEnrolled: enrolled,
        isHost: req.auth ? String(session.instructor?._id ?? session.instructor) === req.auth.userId : false,
      })),
    );
  }),
);

router.get(
  '/:sessionId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { session, isHost } = await sessionAccess(String(req.params.sessionId), req.auth!.userId, req.auth!.role);
    return send(res, {
      ...liveToDTO(session),
      isHost,
      mode: liveMode(),
      seatUrl: null,
    });
  }),
);

router.post(
  '/:sessionId/token',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { session, isHost } = await sessionAccess(String(req.params.sessionId), req.auth!.userId, req.auth!.role);
    if (session.status === 'ended') throw badRequest('This class has finished');

    const credentials = await createLiveToken({
      roomName: session.roomName,
      userId: req.auth!.userId,
      name: req.auth!.name,
      isHost,
    });

    return send(res, {
      sessionId: String(session._id),
      roomName: session.roomName,
      isHost,
      mode: credentials.mode,
      token: credentials.token,
      url: credentials.url,
      title: session.title,
    });
  }),
);

router.patch(
  '/:sessionId/status',
  requireAuth,
  requireRole('instructor', 'admin'),
  asyncHandler(async (req, res) => {
    const { session, isHost } = await sessionAccess(String(req.params.sessionId), req.auth!.userId, req.auth!.role);
    if (!isHost) throw forbidden('Only the host can change the class state');

    const status = (req.body as { status?: string }).status;
    if (!['scheduled', 'live', 'ended'].includes(String(status))) throw badRequest('Unknown status');

    const doc = await LiveSession.findById(session._id);
    if (!doc) throw notFound('Live session not found');
    doc.status = status as any;
    if (status === 'live') {
      doc.startedAt = new Date() as any;
      await ensureLivekitRoom(doc.roomName);
    }
    if (status === 'ended') doc.endedAt = new Date() as any;
    await doc.save();

    const message = await ChatMessage.create({
      session: doc._id,
      user: req.auth!.userId,
      userName: 'Lumen',
      kind: 'system',
      text:
        status === 'live'
          ? 'The class has started — welcome in.'
          : status === 'ended'
            ? 'The class has ended. A recap will be posted here.'
            : 'The host reopened the room.',
    });

    emitTo(`live:${doc._id}`, 'live:status', { sessionId: String(doc._id), status });
    emitTo(`live:${doc._id}`, 'chat:new', {
      id: String(message._id),
      userId: req.auth!.userId,
      userName: 'Lumen',
      text: (message as any).text,
      kind: 'system',
      createdAt: (message as any).createdAt?.toISOString?.() ?? new Date().toISOString(),
    });

    return send(res, { status: doc.status });
  }),
);

router.get(
  '/:sessionId/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    await sessionAccess(String(req.params.sessionId), req.auth!.userId, req.auth!.role);
    const messages = await ChatMessage.find({ session: String(req.params.sessionId) })
      .sort({ createdAt: 1 })
      .limit(150)
      .lean();
    return send(
      res,
      messages.map((message: any) => ({
        id: String(message._id),
        userId: String(message.user),
        userName: message.userName,
        text: message.text,
        kind: message.kind ?? 'chat',
        createdAt: message.createdAt,
      })),
    );
  }),
);

export default router;
