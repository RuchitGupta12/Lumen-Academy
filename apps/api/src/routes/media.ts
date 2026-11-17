import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { Course } from '../models/course';
import { Lesson } from '../models/lesson';
import { VideoAsset } from '../models/video';
import { Enrollment } from '../models/learning';
import { asyncHandler, badRequest, forbidden, notFound, send } from '../lib/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { ensureMediaDirs, mediaPaths, removeVideoFiles } from '../lib/media';
import { createUploadTicket, authorizePlayback, manifestUrl, posterUrl, thumbnailsUrl } from '../lib/media';
import { videoToDTO } from '../lib/serialize';
import { enqueueTranscode } from '../services/queue';

const router = Router();
ensureMediaDirs();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, mediaPaths.uploads),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
      cb(null, `${String(req.params.videoId)}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^video\//.test(file.mimetype) || /\.(mp4|mov|mkv|webm|m4v|avi)$/i.test(file.originalname);
    if (ok) cb(null, true);
    else cb(new Error('Upload a video file (mp4, mov, mkv, webm)'));
  },
});

async function ownedVideo(req: any) {
  const video = await VideoAsset.findById(String(req.params.videoId));
  if (!video) throw notFound('Video not found');
  if (String(video.instructor) !== req.auth.userId && req.auth.role !== 'admin') {
    throw forbidden('This video belongs to another instructor');
  }
  return video;
}

/* ─────────────────────────  Upload handshake  ───────────────────────── */

router.post(
  '/presign',
  requireAuth,
  requireRole('instructor', 'admin'),
  asyncHandler(async (req, res) => {
    const { courseId, lessonId, filename, contentType, size } = req.body as {
      courseId?: string;
      lessonId?: string;
      filename?: string;
      contentType?: string;
      size?: number;
    };

    if (!courseId || !lessonId || !filename) throw badRequest('courseId, lessonId and filename are required');
    if (size && size > 2 * 1024 * 1024 * 1024) throw badRequest('Videos are limited to 2 GB');

    const [course, lesson] = await Promise.all([
      Course.findById(courseId).lean(),
      Lesson.findById(lessonId).lean(),
    ]);
    if (!course || !lesson) throw notFound('Course or lesson not found');
    if (String(course.instructor) !== req.auth!.userId && req.auth!.role !== 'admin') {
      throw forbidden('This course belongs to another instructor');
    }

    // Replace any previous asset attached to the lesson
    const previous = await VideoAsset.find({ lesson: lesson._id }).lean();
    for (const old of previous) {
      removeVideoFiles(String(old._id));
    }
    await VideoAsset.deleteMany({ lesson: lesson._id });

    const asset = await VideoAsset.create({
      course: course._id,
      lesson: lesson._id,
      instructor: req.auth!.userId,
      originalName: filename,
      status: 'uploaded',
    });

    const ticket = await createUploadTicket(
      String(asset._id),
      filename,
      contentType || 'video/mp4',
    );

    await VideoAsset.updateOne({ _id: asset._id }, { $set: { originalKey: ticket.key } });
    await Lesson.updateOne({ _id: lesson._id }, { $set: { video: asset._id, type: 'video' } });

    return send(res, {
      videoId: String(asset._id),
      lessonId: String(lesson._id),
      driver: ticket.driver,
      method: ticket.method,
      uploadUrl: ticket.url,
      headers: ticket.headers ?? {},
      key: ticket.key,
      maxBytes: 2 * 1024 * 1024 * 1024,
    });
  }),
);

router.post(
  '/upload/:videoId',
  requireAuth,
  requireRole('instructor', 'admin'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const video = await ownedVideo(req);
    if (!req.file) throw badRequest('No file received');

    await VideoAsset.updateOne(
      { _id: video._id },
      {
        $set: {
          originalKey: `uploads/${req.file.filename}`,
          originalName: req.file.originalname,
          status: 'uploaded',
          progress: 0,
          error: null,
        },
      },
    );

    return send(res, { videoId: String(video._id), bytes: req.file.size });
  }),
);

router.get(
  '/videos/:videoId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const video = await VideoAsset.findById(String(req.params.videoId)).lean();
    if (!video) throw notFound('Video not found');
    const isOwner = String(video.instructor) === req.auth!.userId || req.auth!.role === 'admin';
    if (!isOwner) {
      const enrolled = await Enrollment.exists({ student: req.auth!.userId, course: video.course });
      if (!enrolled) throw forbidden('Enrol to view this asset');
    }
    return send(res, videoToDTO(video));
  }),
);

router.post(
  '/videos/:videoId/process',
  requireAuth,
  requireRole('instructor', 'admin'),
  asyncHandler(async (req, res) => {
    const video = await ownedVideo(req);
    if (!video.originalKey) throw badRequest('Upload the video file before processing');
    const result = await enqueueTranscode(String(video._id));
    return send(res, { queued: true, ...result }, 202);
  }),
);

router.delete(
  '/videos/:videoId',
  requireAuth,
  requireRole('instructor', 'admin'),
  asyncHandler(async (req, res) => {
    const video = await ownedVideo(req);
    await Lesson.updateOne({ _id: video.lesson }, { $set: { video: null } });
    removeVideoFiles(String(video._id));
    await VideoAsset.deleteOne({ _id: video._id });
    return send(res, { deleted: true });
  }),
);

/* ─────────────────────────────  Playback  ───────────────────────────── */

router.get(
  '/playback/:lessonId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const lesson = await Lesson.findById(String(req.params.lessonId)).lean();
    if (!lesson) throw notFound('Lesson not found');
    const course = await Course.findById(lesson.course).lean();
    if (!course) throw notFound('Course not found');

    const isOwner = String(course.instructor) === req.auth!.userId || req.auth!.role === 'admin';
    const enrolled = await Enrollment.exists({ student: req.auth!.userId, course: course._id });
    if (!enrolled && !isOwner && !lesson.isPreview) {
      throw forbidden('Enrol in this course to watch the lesson');
    }

    if (lesson.type !== 'video') {
      return send(res, {
        type: lesson.type,
        lessonId: String(lesson._id),
        courseId: String(course._id),
        body: lesson.body ?? '',
      });
    }

    const video = lesson.video ? await VideoAsset.findById(lesson.video).lean() : null;
    if (!video) throw notFound('This lesson has no video yet');
    if (video.status !== 'ready') {
      return send(res, {
        lessonId: String(lesson._id),
        status: video.status,
        progress: video.progress ?? 0,
        error: video.error ?? null,
      });
    }

    const mode = await authorizePlayback(res, req.auth!.userId);
    return send(res, {
      lessonId: String(lesson._id),
      courseId: String(course._id),
      title: lesson.title,
      durationSec: video.durationSec ?? lesson.durationSec ?? 0,
      hlsUrl: manifestUrl(String(video._id)),
      posterUrl: posterUrl(String(video._id)),
      thumbnailsUrl: thumbnailsUrl(String(video._id)),
      authorization: mode,
    });
  }),
);

export default router;
