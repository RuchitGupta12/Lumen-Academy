/**
 * Single source of truth for domain types and validation shared by the API,
 * the worker and the web client.
 */
import { z } from 'zod';

/* ─────────────────────────────  Constants  ───────────────────────────── */

export const ROLES = ['student', 'instructor', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const COURSE_STATUSES = ['draft', 'in_review', 'published', 'archived'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const LESSON_TYPES = ['video', 'text', 'quiz', 'live'] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

export const VIDEO_STATUSES = ['uploaded', 'queued', 'processing', 'ready', 'failed'] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const QUESTION_TYPES = ['single', 'multi', 'truefalse'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const COURSE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const COURSE_CATEGORIES = [
  'Development',
  'Design',
  'Data & AI',
  'Business',
  'Marketing',
  'Photography',
] as const;

export const LIVE_STATUSES = ['scheduled', 'live', 'ended'] as const;
export type LiveStatus = (typeof LIVE_STATUSES)[number];

export const PLATFORM_FEE_PCT = 20;
export const COMPLETION_THRESHOLD = 0.9; // 90% of a video must be watched

/* ─────────────────────────────  DTOs  ───────────────────────────────── */

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
  headline?: string | null;
  bio?: string | null;
  createdAt: string;
  status?: 'active' | 'suspended';
}

export interface PublicUser {
  id: string;
  name: string;
  headline?: string | null;
  avatarUrl?: string | null;
}

export interface SectionDTO {
  id: string;
  title: string;
  order: number;
  lessonCount: number;
}

export interface LessonDTO {
  id: string;
  courseId: string;
  sectionId: string;
  title: string;
  type: LessonType;
  order: number;
  durationSec: number;
  isPreview: boolean;
  body?: string | null;
  quizId?: string | null;
  liveSessionId?: string | null;
  video?: VideoDTO | null;
}

export interface VideoDTO {
  id: string;
  status: VideoStatus;
  progress: number;
  durationSec: number;
  error?: string | null;
  hlsUrl?: string | null;
  posterUrl?: string | null;
  thumbnailsUrl?: string | null;
  originalName?: string | null;
}

export interface CourseStats {
  durationSec: number;
  lessonCount: number;
  ratingAvg: number;
  ratingCount: number;
  enrollmentCount: number;
}

export interface CourseDTO {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  level: CourseLevel;
  price: number;
  status: CourseStatus;
  tags: string[];
  cover: { from: string; to: string; motif: string };
  instructor: PublicUser;
  sections: SectionDTO[];
  lessons?: LessonDTO[];
  stats: CourseStats;
  isEnrolled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentDTO {
  id: string;
  courseId: string;
  progressPct: number;
  lastLessonId?: string | null;
  completedAt?: string | null;
  certificateSerial?: string | null;
  course?: CourseDTO;
  createdAt: string;
}

export interface LessonProgressDTO {
  lessonId: string;
  watchedSeconds: number;
  completed: boolean;
}

export interface CourseProgressDTO {
  courseId: string;
  progressPct: number;
  lessons: LessonProgressDTO[];
  completedAt?: string | null;
  certificateSerial?: string | null;
}

export interface QuizQuestionDTO {
  id: string;
  prompt: string;
  type: QuestionType;
  options: string[];
  points: number;
}

export interface QuizDTO {
  id: string;
  courseId: string;
  lessonId?: string | null;
  title: string;
  passingScore: number;
  attemptsAllowed: number;
  timeLimitSec: number;
  questions: QuizQuestionDTO[];
  attemptsUsed: number;
  bestScore?: number | null;
  lastAttemptId?: string | null;
}

export interface AttemptResultDTO {
  attemptId: string;
  score: number;
  maxScore: number;
  passed: boolean;
  breakdown: Array<{
    questionId: string;
    correct: boolean;
    points: number;
    earned: number;
    explanation?: string;
  }>;
}

export interface LiveSessionDTO {
  id: string;
  courseId: string;
  courseTitle?: string;
  instructorName?: string;
  title: string;
  description?: string;
  scheduledAt: string;
  status: LiveStatus;
  roomName: string;
  recordingUrl?: string | null;
  isEnrolled?: boolean;
}

export interface ChatMessageDTO {
  id: string;
  userName: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface CertificateDTO {
  serial: string;
  studentName: string;
  courseTitle: string;
  instructorName: string;
  issuedAt: string;
  verifyUrl: string;
}

export interface OrderDTO {
  id: string;
  courseId: string;
  courseTitle: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  provider: string;
  createdAt: string;
}

export interface MonthlyRevenue {
  month: string;
  gross: number;
  net: number;
  fees: number;
}

export interface InstructorOverviewDTO {
  totals: {
    gross: number;
    net: number;
    fees: number;
    refunds: number;
    students: number;
    courses: number;
    ratingAvg: number;
    ratingCount: number;
  };
  monthly: MonthlyRevenue[];
  topCourses: Array<{
    id: string;
    title: string;
    students: number;
    revenue: number;
    ratingAvg: number;
    status: CourseStatus;
  }>;
  recentOrders: OrderDTO[];
}

export interface AdminMetricsDTO {
  students: number;
  instructors: number;
  courses: number;
  published: number;
  pending: number;
  enrollments: number;
  gross: number;
  certificates: number;
}

export interface AuthResponse {
  user: UserDTO;
  accessToken: string;
}

export interface ApiErrorBody {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/* ─────────────────────────────  Validation  ─────────────────────────── */

const email = z.string().trim().toLowerCase().email('Enter a valid email address');
const password = z.string().min(8, 'Use at least 8 characters').max(72);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Tell us your name').max(80),
  email,
  password,
  role: z.enum(['student', 'instructor']).default('student'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  headline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
  avatarUrl: z.string().trim().url().or(z.literal('')).optional(),
});

export const courseInputSchema = z.object({
  title: z.string().trim().min(6, 'Give the course a longer title').max(120),
  subtitle: z.string().trim().max(180).default(''),
  description: z.string().trim().max(8000).default(''),
  category: z.enum(COURSE_CATEGORIES),
  level: z.enum(COURSE_LEVELS).default('beginner'),
  price: z.coerce.number().min(0).max(999900),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
  cover: z
    .object({
      from: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      to: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      motif: z.string().min(1).max(24),
    })
    .optional(),
});
export type CourseInput = z.infer<typeof courseInputSchema>;

export const sectionInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
});

export const lessonInputSchema = z.object({
  title: z.string().trim().min(2).max(160),
  type: z.enum(LESSON_TYPES).default('video'),
  body: z.string().max(20000).optional(),
  isPreview: z.boolean().default(false),
  durationSec: z.coerce.number().min(0).max(60 * 60 * 6).default(0),
  order: z.coerce.number().int().min(0).optional(),
});

export const questionSchema = z.object({
  prompt: z.string().trim().min(4).max(500),
  type: z.enum(QUESTION_TYPES).default('single'),
  options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
  correct: z.array(z.coerce.number().int().min(0)).min(1),
  points: z.coerce.number().int().min(1).max(20).default(1),
  explanation: z.string().trim().max(600).optional().default(''),
});

export const quizInputSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    passingScore: z.coerce.number().int().min(1).max(100).default(70),
    attemptsAllowed: z.coerce.number().int().min(1).max(20).default(3),
    timeLimitSec: z.coerce.number().int().min(0).max(7200).default(0),
    questions: z.array(questionSchema).min(1, 'Add at least one question').max(30),
  })
  .superRefine((quiz, ctx) => {
    quiz.questions.forEach((q, qi) => {
      q.correct.forEach((c) => {
        if (c >= q.options.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Question ${qi + 1} points at an option that does not exist`,
            path: ['questions', qi, 'correct'],
          });
        }
      });
      if (q.type !== 'multi' && q.correct.length > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question ${qi + 1} can only have one correct answer`,
          path: ['questions', qi, 'correct'],
        });
      }
      if (q.type === 'truefalse' && q.options.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question ${qi + 1} must be True/False`,
          path: ['questions', qi, 'options'],
        });
      }
    });
  });
export type QuizInput = z.infer<typeof quizInputSchema>;

export const quizSubmitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selected: z.array(z.coerce.number().int().min(0)).default([]),
      }),
    )
    .min(1),
});
export type QuizSubmitInput = z.infer<typeof quizSubmitSchema>;

export const progressInputSchema = z.object({
  watchedSeconds: z.coerce.number().min(0).max(60 * 60 * 6),
  completed: z.boolean().optional(),
});

export const liveInputSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(1000).optional().default(''),
  scheduledAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
});

/* ─────────────────────────────  Helpers  ────────────────────────────── */

export function formatMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 70);
}
