import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { connectDb, disconnectDb } from '../config/db';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { ensureMediaDirs, mediaPaths, hlsDir } from '../lib/media';
import { User } from '../models/user';
import { Course } from '../models/course';
import { Lesson } from '../models/lesson';
import { VideoAsset } from '../models/video';
import { Certificate, Enrollment, LessonProgress } from '../models/learning';
import { Quiz, QuizAttempt } from '../models/assessment';
import { ChatMessage, LiveSession } from '../models/live';
import { LedgerEntry, Order } from '../models/commerce';
import { processVideo } from '../services/videoProcess';
import { issueCertificate } from '../services/certificates';
import bcrypt from 'bcryptjs';

const ffmpegPath: string = require('ffmpeg-static');

const PASSWORD = 'Password123!';
const DAY = 24 * 60 * 60 * 1000;

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 6000) stderr = stderr.slice(-6000);
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr.slice(-900)))));
  });
}

async function ensureSampleSource() {
  fs.mkdirSync(mediaPaths.uploads, { recursive: true });
  const target = path.join(mediaPaths.uploads, 'sample-source.mp4');
  if (fs.existsSync(target)) return 'uploads/sample-source.mp4';

  const base = [
    '-y',
    '-t',
    '26',
    '-f',
    'lavfi',
    '-i',
    'gradients=s=1280x720:rate=30:c0=0x0F141C:c1=0xD8542A:x0=0:y0=0:x1=1280:y1=720:speed=0.02',
    '-f',
    'lavfi',
    '-i',
    'anullsrc=r=48000:cl=stereo',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '24',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '64k',
    '-shortest',
    target,
  ];

  try {
    await runFfmpeg(base);
  } catch (error) {
    logger.warn({ error }, 'gradients source failed, falling back to testsrc2');
    await runFfmpeg([
      '-y',
      '-t',
      '26',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=s=1280x720:rate=30',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=48000:cl=stereo',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '26',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      target,
    ]);
  }

  return 'uploads/sample-source.mp4';
}

/* ──────────────────────────────  Content  ───────────────────────────── */

type CourseSpec = {
  title: string;
  subtitle: string;
  category: 'Development' | 'Design' | 'Data & AI' | 'Business' | 'Marketing' | 'Photography';
  level: 'beginner' | 'intermediate' | 'advanced';
  price: number;
  tags: string[];
  cover: { from: string; to: string; motif: string };
  instructor: 'maya' | 'dev' | 'lena';
  description: string;
  sections: Array<{
    title: string;
    lessons: Array<{ title: string; type: 'video' | 'text' | 'quiz'; preview?: boolean }>;
  }>;
  quiz?: {
    title: string;
    passingScore: number;
    questions: Array<{
      prompt: string;
      type: 'single' | 'multi' | 'truefalse';
      options: string[];
      correct: number[];
      explanation: string;
    }>;
  };
};

const COURSES: CourseSpec[] = [
  {
    title: 'Production-Grade React Architecture',
    subtitle: 'Design frontends that survive their second year — state, data flow and rendering budgets.',
    category: 'Development',
    level: 'advanced',
    price: 8900,
    tags: ['React', 'Redux Toolkit', 'Performance'],
    cover: { from: '#2C3E50', to: '#0B0D11', motif: '⌘' },
    instructor: 'maya',
    description:
      'Most React codebases fail slowly: prop drilling becomes context soup, server state gets copied into Redux, and every feature adds another effect. This course rebuilds your mental model around boundaries — what belongs to the router, what belongs to the server cache, and what genuinely belongs in client state. We refactor a real dashboard across seven lessons, measure the render budget before and after, and finish with a review checklist you can run in your own pull requests.',
    sections: [
      {
        title: 'Foundations & boundaries',
        lessons: [
          { title: 'Why most React apps collapse at scale', type: 'video', preview: true },
          { title: 'The four state layers, drawn clearly', type: 'video' },
          { title: 'Reading the architecture brief', type: 'text' },
        ],
      },
      {
        title: 'Server state with RTK Query',
        lessons: [
          { title: 'Modelling endpoints and cache tags', type: 'video' },
          { title: 'Optimistic updates without lying to the UI', type: 'video' },
          { title: 'Checkpoint: cache design', type: 'quiz' },
        ],
      },
      {
        title: 'Rendering budgets',
        lessons: [
          { title: 'Measuring before you optimise', type: 'video' },
          { title: 'Splitting routes, not components', type: 'video' },
          { title: 'A review checklist for your team', type: 'text' },
        ],
      },
    ],
    quiz: {
      title: 'Server state checkpoint',
      passingScore: 70,
      questions: [
        {
          prompt: 'Where should a list of courses fetched from the API live?',
          type: 'single',
          options: ['RTK Query cache', 'A local useState in each page', 'A module-level array', 'Redux slice synced by useEffect'],
          correct: [0],
          explanation: 'Server state belongs in the data cache; copying it into a slice doubles the invalidation work.',
        },
        {
          prompt: 'Which signals usually justify client-side global state?',
          type: 'multi',
          options: ['Authenticated user identity', 'A fetched list of orders', 'Theme preference', 'Server pagination cursor'],
          correct: [0, 2],
          explanation: 'Identity and UI preferences are client-owned. Fetched data and cursors are server-owned.',
        },
        {
          prompt: 'Splitting a large component into more components always improves render performance.',
          type: 'truefalse',
          options: ['True', 'False'],
          correct: [1],
          explanation: 'Splitting changes where state lives; without stabilising references it can add re-renders.',
        },
      ],
    },
  },
  {
    title: 'Design Systems in Figma: Tokens to Handoff',
    subtitle: 'Build a token-driven system that engineers can adopt without a translation layer.',
    category: 'Design',
    level: 'intermediate',
    price: 6400,
    tags: ['Figma', 'Design tokens', 'Accessibility'],
    cover: { from: '#7A3B22', to: '#160D08', motif: '◐' },
    instructor: 'dev',
    description:
      'A design system is a contract, not a component library. We start from a brand audit, define a three-tier token model (primitive, semantic, component), and build Figma variables that mirror the CSS custom properties your team ships. You will produce a documented component spec, a contribution workflow, and a versioning policy that survives a rebrand.',
    sections: [
      {
        title: 'Audit to architecture',
        lessons: [
          { title: 'Auditing an inconsistent product', type: 'video', preview: true },
          { title: 'Primitive, semantic and component tokens', type: 'video' },
          { title: 'Naming rules that scale', type: 'text' },
        ],
      },
      {
        title: 'Figma variables in practice',
        lessons: [
          { title: 'Modes, themes and contrast', type: 'video' },
          { title: 'Building a component spec sheet', type: 'video' },
          { title: 'Token handoff quiz', type: 'quiz' },
        ],
      },
    ],
    quiz: {
      title: 'Token handoff check',
      passingScore: 60,
      questions: [
        {
          prompt: 'Which token tier should a button background reference?',
          type: 'single',
          options: ['Primitive', 'Semantic', 'Component', 'Raw hex'],
          correct: [1],
          explanation: 'Components should consume semantic tokens so themes can swap underneath them.',
        },
        {
          prompt: 'Semantic tokens may reference other tokens.',
          type: 'truefalse',
          options: ['True', 'False'],
          correct: [0],
          explanation: 'Semantic aliases point at primitives — that aliasing is what makes theming cheap.',
        },
      ],
    },
  },
  {
    title: 'Practical Machine Learning with Python',
    subtitle: 'Ship a model that earns its place in production — evaluation first, notebooks second.',
    category: 'Data & AI',
    level: 'intermediate',
    price: 11900,
    tags: ['Python', 'scikit-learn', 'Evaluation'],
    cover: { from: '#21443C', to: '#07100D', motif: '⌁' },
    instructor: 'maya',
    description:
      'This is a working course for people who have trained a model and watched it disappoint in production. We start from the decision the model supports, design the evaluation set before touching features, and only then build. You will construct a leakage-resistant pipeline, calibrate probabilities, and write the monitoring plan that catches drift three weeks before your users do.',
    sections: [
      {
        title: 'Framing the decision',
        lessons: [
          { title: 'From business question to label', type: 'video', preview: true },
          { title: 'Building the evaluation set first', type: 'video' },
          { title: 'Leakage field guide', type: 'text' },
        ],
      },
      {
        title: 'Pipelines that hold up',
        lessons: [
          { title: 'Column transformers and folds', type: 'video' },
          { title: 'Calibration and thresholds', type: 'video' },
          { title: 'Model evaluation quiz', type: 'quiz' },
        ],
      },
      {
        title: 'After deployment',
        lessons: [
          { title: 'Monitoring with three numbers', type: 'video' },
        ],
      },
    ],
    quiz: {
      title: 'Evaluation checkpoint',
      passingScore: 70,
      questions: [
        {
          prompt: 'Your dataset is 2% positives. Which headline metric is most misleading?',
          type: 'single',
          options: ['Accuracy', 'Recall', 'Precision-Recall AUC', 'F1'],
          correct: [0],
          explanation: 'A constant "no" classifier scores 98% accuracy while catching nothing.',
        },
        {
          prompt: 'Which practices reduce leakage?',
          type: 'multi',
          options: ['Fit preprocessing inside each fold', 'Split before feature engineering', 'Tune on the test set', 'Use time-based splits for temporal data'],
          correct: [0, 1, 3],
          explanation: 'Tuning on the test set turns it into a validation set and inflates your reported numbers.',
        },
      ],
    },
  },
  {
    title: "The Founder's Finance Stack",
    subtitle: 'Runway, unit economics and pricing decisions you can defend to a board.',
    category: 'Business',
    level: 'beginner',
    price: 4900,
    tags: ['Finance', 'SaaS metrics', 'Fundraising'],
    cover: { from: '#5A3B12', to: '#120B03', motif: '✳' },
    instructor: 'dev',
    description:
      'Most early finance mistakes are not arithmetic errors — they are definition errors. This course builds one spreadsheet you will actually maintain: a 18-month runway model, a cohort-based retention view, and a pricing test log. By the end you can answer the three questions every investor asks without opening a deck.',
    sections: [
      {
        title: 'The model',
        lessons: [
          { title: 'Definitions that change decisions', type: 'video', preview: true },
          { title: 'Building an 18-month runway', type: 'video' },
          { title: 'The one-page board view', type: 'text' },
        ],
      },
      {
        title: 'Unit economics',
        lessons: [
          { title: 'CAC, payback and expansion', type: 'video' },
          { title: 'Cohort retention without vanity', type: 'video' },
          { title: 'Pricing and margin quiz', type: 'quiz' },
        ],
      },
    ],
    quiz: {
      title: 'Finance fundamentals',
      passingScore: 60,
      questions: [
        {
          prompt: 'CAC payback of 18 months means…',
          type: 'single',
          options: ['Gross profit repays acquisition cost in 18 months', 'Customers churn after 18 months', 'You break even in 18 months overall', 'Revenue equals CAC at month 18'],
          correct: [0],
          explanation: 'Payback uses gross profit per account, not revenue.',
        },
        {
          prompt: 'Raising prices always improves net revenue retention.',
          type: 'truefalse',
          options: ['True', 'False'],
          correct: [1],
          explanation: 'Only when churn and downgrade pressure stay flat — often they do not.',
        },
      ],
    },
  },
  {
    title: 'Documentary Storytelling on a Budget',
    subtitle: 'Find the story, hold the frame, and finish a short film with two people and one camera.',
    category: 'Photography',
    level: 'intermediate',
    price: 7400,
    tags: ['Filmmaking', 'Interview', 'Sound'],
    cover: { from: '#3A2C55', to: '#0C0A14', motif: '◇' },
    instructor: 'lena',
    description:
      'A documentary is a series of decisions about what to leave out. We cover story-finding in the field, interview craft that produces usable answers, available-light cinematography, and a post workflow you can finish on a laptop. The final project is a four-minute portrait of someone within walking distance of your home.',
    sections: [
      {
        title: 'Finding the story',
        lessons: [
          { title: 'The four-minute portrait', type: 'video', preview: true },
          { title: 'Pre-interview research that pays off', type: 'video' },
          { title: 'A shot list you can trust', type: 'text' },
        ],
      },
      {
        title: 'Production and post',
        lessons: [
          { title: 'Available light, honest faces', type: 'video' },
          { title: 'Sound is half the image', type: 'video' },
          { title: 'Story structure quiz', type: 'quiz' },
        ],
      },
    ],
    quiz: {
      title: 'Story structure',
      passingScore: 60,
      questions: [
        {
          prompt: 'The strongest opening for a short documentary is usually…',
          type: 'single',
          options: ['A slow aerial establishing shot', 'A moment of change already in motion', 'A title card explaining context', 'An interview where someone introduces themselves'],
          correct: [1],
          explanation: 'Start inside tension; context can arrive seconds later.',
        },
        {
          prompt: 'Room tone is optional if you record clean dialogue.',
          type: 'truefalse',
          options: ['True', 'False'],
          correct: [1],
          explanation: 'You need room tone to bridge edits without audible gaps.',
        },
      ],
    },
  },
  {
    title: 'Technical Writing That Ships',
    subtitle: 'Documentation as a product surface: structure, examples and review that engineers trust.',
    category: 'Marketing',
    level: 'beginner',
    price: 3900,
    tags: ['Writing', 'Docs', 'Developer experience'],
    cover: { from: '#1E3A5F', to: '#070B12', motif: '≡' },
    instructor: 'lena',
    description:
      'Good docs reduce support load and shorten time-to-first-success. This course treats documentation as a lifecycle: scope the page, write the example first, test every instruction, and instrument the result. You will rewrite one real README and one onboarding guide, with peer review built into the workflow.',
    sections: [
      {
        title: 'Structure before prose',
        lessons: [
          { title: 'The four page types', type: 'video', preview: true },
          { title: 'Writing the example first', type: 'video' },
          { title: 'Docs review checklist', type: 'text' },
        ],
      },
      {
        title: 'Shipping and measuring',
        lessons: [
          { title: 'Testing instructions like code', type: 'video' },
          { title: 'Instrumenting your docs', type: 'video' },
          { title: 'Documentation craft quiz', type: 'quiz' },
        ],
      },
    ],
    quiz: {
      title: 'Docs craft',
      passingScore: 60,
      questions: [
        {
          prompt: 'The most reliable way to find broken setup instructions is…',
          type: 'single',
          options: ['Ask a teammate to read them', 'Run them on a clean machine', 'Spellcheck the page', 'Add more screenshots'],
          correct: [1],
          explanation: 'A clean environment surfaces missing prerequisites that familiarity hides.',
        },
        {
          prompt: 'A tutorial should end with a working result.',
          type: 'truefalse',
          options: ['True', 'False'],
          correct: [0],
          explanation: 'That success state is the point of the page.',
        },
      ],
    },
  },
  {
    title: 'Rust for TypeScript Developers',
    subtitle: 'Ownership, borrowing and error handling explained through code you already understand.',
    category: 'Development',
    level: 'advanced',
    price: 9900,
    tags: ['Rust', 'TypeScript', 'Systems'],
    cover: { from: '#2F3B2C', to: '#080C07', motif: '⌃' },
    instructor: 'maya',
    description:
      'You know how to model data with types; Rust asks you to also model ownership. This draft course rebuilds familiar TypeScript patterns in Rust, then introduces the ideas TypeScript does not have — borrowing, lifetimes, traits as capability bounds — with a small CLI you extend each lesson.',
    sections: [
      {
        title: 'From types to ownership',
        lessons: [
          { title: 'The mental model shift', type: 'video', preview: true },
          { title: 'Results instead of exceptions', type: 'video' },
        ],
      },
    ],
  },
];

const STUDENTS = [
  { name: 'Aarav Mehta', email: 'student@lumen.academy' },
  { name: 'Sofia Almeida', email: 'sofia@example.com' },
  { name: 'Jonas Weber', email: 'jonas@example.com' },
  { name: 'Priya Raman', email: 'priya@example.com' },
  { name: 'Daniel Okafor', email: 'daniel@example.com' },
  { name: 'Mei Lin', email: 'mei@example.com' },
  { name: 'Tomás Rivera', email: 'tomas@example.com' },
  { name: 'Hannah Cole', email: 'hannah@example.com' },
  { name: 'Yusuf Demir', email: 'yusuf@example.com' },
  { name: 'Elena Petrova', email: 'elena@example.com' },
];

const TEXT_BODY = `## What you will build

A working slice of the final project, scoped so you can finish it in this session.

1. Read the brief and write down the single decision this work supports.
2. Sketch the data shape before writing components or queries.
3. Build the smallest end-to-end path, then widen it.

## Notes from the studio

Keep the diff reviewable. If a change touches more than three concerns, stop and split it — your future self is the reviewer.

> The goal is not a clever abstraction. The goal is a change you can make on a Tuesday afternoon without fear.`;

/* ───────────────────────────────  Seed  ─────────────────────────────── */

async function seed() {
  ensureMediaDirs();

  if (env.mongoUri && !process.argv.includes('--force')) {
    logger.error(
      'MONGODB_URI is set to an external database. Re-run with --force if you really want to wipe it.',
    );
    process.exit(1);
  }

  await connectDb();
  logger.info('clearing collections');
  await Promise.all([
    User.deleteMany({}),
    Course.deleteMany({}),
    Lesson.deleteMany({}),
    VideoAsset.deleteMany({}),
    Enrollment.deleteMany({}),
    LessonProgress.deleteMany({}),
    Certificate.deleteMany({}),
    Quiz.deleteMany({}),
    QuizAttempt.deleteMany({}),
    LiveSession.deleteMany({}),
    ChatMessage.deleteMany({}),
    Order.deleteMany({}),
    LedgerEntry.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [admin, maya, dev, lena] = await User.create([
    {
      name: 'Ruchit Sharma',
      email: 'admin@lumen.academy',
      passwordHash,
      role: 'admin',
      headline: 'Platform administrator',
      bio: 'Keeps the catalog honest and the payouts correct.',
    },
    {
      name: 'Maya Chen',
      email: 'maya@lumen.academy',
      passwordHash,
      role: 'instructor',
      headline: 'Staff engineer · React & ML systems',
      bio: 'Fifteen years shipping interfaces that stay maintainable. Teaches architecture and applied ML at Lumen.',
    },
    {
      name: 'Dev Patel',
      email: 'dev@lumen.academy',
      passwordHash,
      role: 'instructor',
      headline: 'Design systems lead · Figma',
      bio: 'Builds token pipelines for product teams and writes about design operations.',
    },
    {
      name: 'Lena Ortiz',
      email: 'lena@lumen.academy',
      passwordHash,
      role: 'instructor',
      headline: 'Documentary filmmaker & writer',
      bio: 'Makes short non-fiction films and teaches teams how to explain their work clearly.',
    },
  ]);

  const studentDocs: any[] = (await User.create(
    STUDENTS.map((student) => ({
      ...student,
      passwordHash,
      role: 'student',
      headline: null,
    })) as any,
  )) as any;

  const instructorMap: Record<string, any> = { maya, dev, lena };
  const sampleKey = await ensureSampleSource();

  logger.info('building catalog');
  const createdCourses: Array<{ course: any; lessons: any[] }> = [];

  for (const [index, spec] of COURSES.entries()) {
    const instructor = instructorMap[spec.instructor];
    const isPublished = spec.title !== 'Rust for TypeScript Developers';

    const course: any = await Course.create({
      title: spec.title,
      slug: spec.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-'),
      subtitle: spec.subtitle,
      description: spec.description,
      category: spec.category,
      level: spec.level,
      price: spec.price,
      instructor: instructor._id,
      status: isPublished ? 'published' : 'draft',
      tags: spec.tags,
      cover: spec.cover,
      publishedAt: isPublished ? new Date(Date.now() - (30 - index * 3) * DAY) : null,
      sections: spec.sections.map((section: any, sectionIndex: number) => ({
        title: section.title,
        order: sectionIndex,
      })),
      stats: { ratingAvg: 0, ratingCount: 0, enrollmentCount: 0 },
    });

    const lessons: any[] = [];
    let lessonOrder = 0;

    for (const [sectionIndex, section] of spec.sections.entries()) {
      for (const lessonSpec of section.lessons as any[]) {
        const lesson: any = await Lesson.create({
          course: course._id,
          sectionId: (course.sections as any)[sectionIndex]._id,
          title: lessonSpec.title,
          type: lessonSpec.type,
          order: lessonOrder,
          isPreview: !!(lessonSpec as any).preview,
          body: lessonSpec.type === 'text' ? TEXT_BODY : '',
          durationSec: lessonSpec.type === 'video' ? 26 : 0,
        });
        lessons.push(lesson);
        lessonOrder += 1;
      }
    }

    // Quiz lessons
    if (spec.quiz) {
      const quizLesson = lessons.find((lesson) => lesson.type === 'quiz');
      if (quizLesson) {
        const quiz: any = await Quiz.create({
          course: course._id,
          lesson: quizLesson._id,
          instructor: instructor._id,
          title: spec.quiz.title,
          passingScore: spec.quiz.passingScore,
          attemptsAllowed: 3,
          timeLimitSec: 600,
          questions: spec.quiz.questions,
        });
        await Lesson.updateOne({ _id: quizLesson._id }, { $set: { quiz: quiz._id, durationSec: 300 } });
        quizLesson.durationSec = 300;
      }
    }

    // Video assets — every video lesson points at the real generated HLS ladder
    const videoLessons = lessons.filter((lesson) => lesson.type === 'video');
    for (const lesson of videoLessons) {
      const asset = await VideoAsset.create({
        course: course._id,
        lesson: lesson._id,
        instructor: instructor._id,
        originalName: `${lesson.title}.mp4`,
        originalKey: sampleKey,
        status: 'uploaded',
        progress: 0,
      });
      await Lesson.updateOne({ _id: lesson._id }, { $set: { video: asset._id } });
      lesson.video = asset._id;
    }

    const duration = lessons.reduce((sum, lesson) => sum + (lesson.durationSec ?? 0), 0);
    await Course.updateOne(
      { _id: course._id },
      {
        $set: {
          'stats.lessonCount': lessons.length,
          'stats.durationSec': duration,
          'stats.ratingAvg': 4.5 + (index % 5) * 0.1,
          'stats.ratingCount': 40 + index * 37,
        },
      },
    );

    createdCourses.push({ course, lessons });
  }

  logger.info('encoding sample video through the FFmpeg pipeline (one-time, ~1 minute)');
  const allVideos = await VideoAsset.find({}).sort({ createdAt: 1 }).lean();
  const template = allVideos[0];
  if (template) {
    await processVideo(String(template._id), (percent, stage) => {
      if (percent === 1 || percent >= 100 || Math.round(percent) % 20 === 0) {
        logger.info({ percent: Math.round(percent), stage }, 'sample encode');
      }
    });

    const templateDir = hlsDir(String(template._id));
    const templateDoc = await VideoAsset.findById(template._id).lean();
    const rest = allVideos.slice(1);

    for (const [index, asset] of rest.entries()) {
      const dir = hlsDir(String(asset._id));
      fs.rmSync(dir, { recursive: true, force: true });
      fs.cpSync(templateDir, dir, { recursive: true });
      await VideoAsset.updateOne(
        { _id: asset._id },
        {
          $set: {
            status: 'ready',
            progress: 100,
            durationSec: templateDoc?.durationSec ?? 26,
            renditions: templateDoc?.renditions ?? [],
            posterKey: `hls/${asset._id}/poster.jpg`,
            thumbnailsKey: `hls/${asset._id}/thumbs.vtt`,
            manifestKey: `hls/${asset._id}/master.m3u8`,
            processedAt: new Date(),
          },
        },
      );
      if (index % 8 === 0) logger.info({ copied: index + 1 }, 'cloning sample ladder');
    }
  }

  logger.info('enrolling learners');
  const published = createdCourses.filter((entry) => entry.course.status === 'published');

  for (const [courseIndex, entry] of published.entries()) {
    const enrolledStudents = studentDocs.filter((_, studentIndex) =>
      (studentIndex + courseIndex) % 2 === 0 || studentIndex === 0,
    );

    for (const [studentIndex, student] of enrolledStudents.entries()) {
      const enrollment: any = await Enrollment.create({
        student: student._id,
        course: entry.course._id,
        pricePaid: entry.course.price,
        progressPct: 0,
        lastLessonId: entry.lessons[0]?._id ?? null,
      });

      // Everyone finishes the first two lessons; one learner finishes everything.
      const completionTarget = studentIndex === 0 && courseIndex === 0 ? entry.lessons.length : 2;
      const completed = entry.lessons.slice(0, completionTarget);

      await LessonProgress.create(
        completed.map((lesson: any) => ({
          student: student._id,
          course: entry.course._id,
          lesson: lesson._id,
          watchedSeconds: lesson.durationSec ?? 30,
          completed: true,
        })),
      );

      const pct = Math.round((completed.length / entry.lessons.length) * 100);
      await Enrollment.updateOne(
        { _id: enrollment._id },
        {
          $set: {
            progressPct: pct,
            completedAt: pct >= 100 ? new Date(Date.now() - 9 * DAY) : null,
            lastLessonId: completed[completed.length - 1]?._id ?? null,
          },
        },
      );

      if (pct >= 100) {
        const certificate: any = await issueCertificate(String(student._id), String(entry.course._id));
        await Enrollment.updateOne(
          { _id: enrollment._id },
          { $set: { certificateId: (certificate as any)._id } },
        );
      }

      if (entry.course.price > 0) {
        const paidAt = new Date(Date.now() - (courseIndex * 18 + studentIndex * 3 + 4) * DAY);
        const order: any = await Order.create({
          student: student._id,
          course: entry.course._id,
          instructor: entry.course.instructor,
          amount: entry.course.price,
          currency: 'usd',
          provider: courseIndex % 3 === 0 ? 'stripe' : 'mock',
          providerSessionId: `seed_${entry.course._id}_${student._id}`,
          status: 'paid',
          paidAt,
        });
        await Order.updateOne({ _id: order._id }, { $set: { createdAt: paidAt } });

        const fee = Math.round((entry.course.price * env.platformFeePct) / 100);
        await LedgerEntry.create({
          instructor: entry.course.instructor,
          order: order._id,
          course: entry.course._id,
          student: student._id,
          gross: entry.course.price,
          platformFeePct: env.platformFeePct,
          fee,
          net: entry.course.price - fee,
          status: 'available',
          availableAt: paidAt,
        });
      }
    }

    await Course.updateOne(
      { _id: entry.course._id },
      { $set: { 'stats.enrollmentCount': enrolledStudents.length } },
    );
  }

  // One refunded order so the dashboard has a reversal to explain.
  const refundable = await Order.findOne({ status: 'paid' }).sort({ createdAt: 1 }).lean();
  if (refundable) {
    await Order.updateOne(
      { _id: refundable._id },
      { $set: { status: 'refunded', refundedAt: new Date(Date.now() - 2 * DAY) } },
    );
    await LedgerEntry.updateOne(
      { order: refundable._id },
      { $set: { status: 'reversed', reversedAt: new Date(Date.now() - 2 * DAY) } },
    );
  }

  logger.info('scheduling live classes');
  const liveCourse = published[0];
  const liveCourse2 = published[2] ?? published[1];

  const liveNow = await LiveSession.create({
    course: liveCourse.course._id,
    instructor: liveCourse.course.instructor,
    title: 'Live architecture review — bring your repo',
    description: 'We review three learner repos and refactor one together on screen.',
    scheduledAt: new Date(Date.now() - 10 * 60 * 1000),
    status: 'live',
    roomName: `lumen-${String(liveCourse.course._id).slice(-6)}-live`,
    startedAt: new Date(Date.now() - 10 * 60 * 1000),
  });

  await LiveSession.create({
    course: liveCourse2.course._id,
    instructor: liveCourse2.course.instructor,
    title: 'Office hours: evaluation sets and leakage',
    description: 'Open Q&A on the checkpoint project.',
    scheduledAt: new Date(Date.now() + 3 * DAY),
    status: 'scheduled',
    roomName: `lumen-${String(liveCourse2.course._id).slice(-6)}-next`,
  });

  await ChatMessage.create([
    {
      session: liveNow._id,
      user: liveCourse.course.instructor,
      userName: 'Lumen',
      kind: 'system',
      text: 'The class has started — welcome in.',
    },
    {
      session: liveNow._id,
      user: studentDocs[1]?._id ?? studentDocs[0]._id,
      userName: studentDocs[1]?.name ?? 'Sofia Almeida',
      text: 'Can we look at optimistic updates when the server rejects?',
    },
  ]);

  await User.updateOne(
    { _id: studentDocs[0]._id },
    { $set: { headline: 'Frontend engineer learning in public' } },
  );

  const counts = {
    users: await User.countDocuments(),
    courses: await Course.countDocuments(),
    lessons: await Lesson.countDocuments(),
    videos: await VideoAsset.countDocuments({ status: 'ready' }),
    enrollments: await Enrollment.countDocuments(),
    quizzes: await Quiz.countDocuments(),
    certificates: await Certificate.countDocuments(),
    orders: await Order.countDocuments(),
  };

  logger.info(counts, 'seed complete');

  const base = env.clientOrigin;
  process.stdout.write(
    [
      '',
      '  ─────────────────────────────────────────────────────────────',
      '   Lumen Academy is seeded.',
      '',
      `   Admin       admin@lumen.academy      / ${PASSWORD}`,
      `   Instructor  maya@lumen.academy       / ${PASSWORD}`,
      `   Instructor  lena@lumen.academy       / ${PASSWORD}`,
      `   Student     student@lumen.academy    / ${PASSWORD}`,
      '',
      `   Open ${base} and sign in as the student to see a`,
      '   course in progress, or as Maya to open the revenue dashboard.',
      '  ─────────────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  );

  await disconnectDb();
  process.exit(0);
}

seed().catch(async (error) => {
  logger.error({ error }, 'seed failed');
  await disconnectDb();
  process.exit(1);
});
