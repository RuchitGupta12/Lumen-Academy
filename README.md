# Lumen Academy

A complete MERN learning platform built for the seven-milestone project brief: course authoring, a real FFmpeg → HLS video pipeline, quizzes with auto-grading, progress tracking, PDF certificates, live classes with chat, Stripe test-mode payments, and instructor revenue reporting.

The app runs **locally with zero external infrastructure**. MongoDB, Redis, FFmpeg, object storage, payments, and live video all sit behind driver interfaces with self-contained defaults, so `npm install && npm run seed && npm run dev` is enough to see every feature.

> 🎬 **Screen-recorded demo (70 s, 720p):** [`docs/demo/lumen-academy-demo.mp4`](docs/demo/lumen-academy-demo.mp4)

---

## Table of contents

- [What is included](#what-is-included)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [Driver matrix](#driver-matrix)
- [Useful commands](#useful-commands)
- [Repository layout](#repository-layout)
- [Design system](#design-system)
- [Documentation](#documentation)
- [Testing and verification](#testing-and-verification)
- [Notes and known constraints](#notes-and-known-constraints)

---

## What is included

| Milestone | Delivered |
|---|---|
| 1 · Roles & schemas | `student` / `instructor` / `admin`, RBAC on every route and page, Mongoose models for courses, lessons, enrollments, progress, quizzes, live sessions, certificates, orders and ledger entries |
| 2 · Authoring & video | Section/lesson editor, drag reorder, upload handshake, **real FFmpeg transcode** to fMP4 HLS (360p + 720p), poster, WebVTT thumbnails, live progress over Socket.IO, BullMQ or in-process queue |
| 3 · Streaming delivery | Signed playback tickets, `lumen_media` cookie gating for `/media/*`, CloudFront signed-cookie adapter with caching headers; byte-identical URL shape in local mode |
| 4 · Quizzes & progress | Sanitized quiz fetch (no correct answers leak), single/multi/true-false grading with partial credit, attempt limits and timers, 90% watch threshold, completion → certificate, quiz analytics |
| 5 · Live classes | Session scheduling, role-scoped room tokens, simulated camera preview + realtime chat/presence, lazy-loaded LiveKit WebRTC stage when keys are present |
| 6 · Certificates | Idempotent A4 PDF generation (Fraunces wordmark, wax seal, QR → verify URL), authenticated download, public `/verify/:serial` |
| 7 · Payments & revenue | Mock checkout with decline/success test cards, Stripe Checkout + signed webhook, idempotent order fulfilment, 20% platform fee ledger, revenue charts, payouts, CSV export, refund reversal |
| 8 · Polish & docs | Dark/light "Ink & Ember" theme, responsive layouts, loading/empty/error states, 41 automated API tests, 41 runtime E2E checks, perf numbers, this documentation set and a recorded demo |

---

## Tech stack

| Layer | Choice |
|---|---|
| API | Express 5 + TypeScript, Zod validation, pino logging, helmet, express-rate-limit |
| Database | MongoDB via Mongoose — bundled `mongodb-memory-server` (persistent) or any `MONGODB_URI` |
| Queue | BullMQ + Redis, with a dependency-free in-process driver for the demo |
| Video | `ffmpeg-static` + `ffprobe-static` → fMP4 HLS, poster, WebVTT thumbnails |
| Storage / CDN | Local `media/` tree with signed cookies; S3 + CloudFront signed-cookie adapter |
| Realtime | Socket.IO (upload/transcode progress, live presence and chat) |
| Live video | LiveKit Cloud via `livekit-server-sdk` + `@livekit/components-react`, simulated fallback |
| Payments | Stripe test mode (Checkout + webhook) with a built-in mock gateway |
| PDF | `pdfkit` + `qrcode` |
| Client | React 19 + Vite + TypeScript + Redux Toolkit / RTK Query + Tailwind CSS v4 |
| Tests | Vitest + Supertest against an isolated in-memory MongoDB |

---

## Quick start

### Prerequisites

- **Node.js 20+** and npm (verified on Node 24 / npm 11)
- Nothing else — no Docker, system MongoDB, Redis, or FFmpeg installation required

### 1. Install

```bash
npm install
```

npm workspaces install all three packages (`@lumen/api`, `@lumen/web`, `@lumen/shared`) and download the bundled MongoDB and FFmpeg binaries on first run.

### 2. Configure (optional)

```bash
cp .env.example .env
```

Every setting has a working default. **You do not need to edit `.env` for the full local demo.** See the [driver matrix](#driver-matrix) and [`.env.example`](.env.example) for production switches.

### 3. Seed the demo data

```bash
npm run seed
```

This creates the users, six published courses (one draft), 29 lessons, quizzes, enrollments, progress, orders, a refunded ledger reversal, live sessions, and a certificate. It generates one 26-second source clip with bundled FFmpeg, runs it through the real HLS pipeline once, then clones the ladder to every video lesson so the seed finishes quickly.

> The seed clears all collections. Re-run it any time to restore a clean demo state.

### 4. Run

```bash
npm run dev
```

| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:4000 |
| Health check | http://localhost:4000/health |
| Runtime config | http://localhost:4000/api/v1/config |

The API process owns the bundled MongoDB on port `27099` (data persisted in `.data/mongo`). The web dev server proxies `/api` and `/media` to the API. Once you have built the web app, the API also serves `apps/web/dist` as a single-process deployment.

---

## Demo accounts

All accounts use password **`Password123!`**.

| Role | Email | What to look at |
|---|---|---|
| Admin | `admin@lumen.academy` | Platform metrics, user management, course moderation, orders |
| Instructor | `maya@lumen.academy` | Revenue dashboard, course management, students, live classes |
| Instructor | `lena@lumen.academy` | A second instructor's isolated data |
| Student | `student@lumen.academy` | Enrolled courses, in-progress lessons, a completed certificate |

**Payment tests:** sign up as a new student (the demo student already owns every published course), then check out. `4242 4242 4242 4242` succeeds; any card ending in `0002` declines.

---

## Driver matrix

Each integration is an adapter selected by environment variables. Defaults are the left column.

| Capability | Default | Alternative | Env switch |
|---|---|---|---|
| Database | bundled MongoDB on `:27099`, persistent | Atlas / any MongoDB | `MONGODB_URI` |
| Media storage | local `media/` + signed cookie | S3 private bucket + CloudFront signed cookies | `MEDIA_DRIVER=s3` + AWS/CloudFront keys |
| Queue | in-process serializer | BullMQ (3 retries, exponential backoff) | `QUEUE_DRIVER=bullmq` + `REDIS_URL` |
| Payments | mock checkout, instant fulfilment | Stripe test mode Checkout + webhook | `PAYMENTS_DRIVER=stripe` + Stripe keys |
| Live classes | simulated room (local camera + Socket.IO chat) | LiveKit Cloud SFU with screen share and device controls | `LIVE_DRIVER=livekit` + LiveKit keys |
| HLS ladder | `360,720` at 4 s segments | any of 240/360/480/720/1080 | `HLS_RENDITIONS`, `HLS_SEGMENT_SECONDS` |

`GET /api/v1/config` and `GET /health` report the active drivers at runtime. Switching drivers requires no client changes.

> **Port ownership:** the bundled MongoDB on `27099` can only be owned by one process. The API starts it; the seed and worker attach to it. Stop the API before re-running `npm run seed`.

---

## Useful commands

| Command | Description |
|---|---|
| `npm run dev` | Start API + web dev servers together |
| `npm run dev:api` / `npm run dev:web` | Start one side |
| `npm run seed` | Reset and populate demo data |
| `npm test` | Run the 41-test Vitest/Supertest API suite (isolated random-port MongoDB) |
| `npm run typecheck` | TypeScript check for API and web |
| `npm run build` | Production build of the web app |
| `npm run worker` | BullMQ worker process (only with `QUEUE_DRIVER=bullmq`) |

---

## Repository layout

```
FS-03/
├── apps/
│   ├── api/                  Express app, models, routes, services, realtime, seed
│   │   ├── src/{config,lib,middleware,models,routes,realtime,scripts,services,types}
│   │   └── tests/api.test.ts 41 Supertest integration tests
│   └── web/                  React client
│       └── src/{api,App,components,hooks,pages,store,styles}
├── packages/shared/          Zod schemas, DTO types, domain constants
├── docs/
│   ├── architecture.md       System design, data model, request lifecycles
│   ├── api.md                REST + Socket.IO reference
│   ├── test-report.md        Test results, perf and build numbers
│   ├── demo-script.md        10-minute presentation + recorded shot list
│   ├── reflections.md        Individual intern reflections
│   └── demo/                 Screen-recorded demo MP4
├── media/                    Generated uploads, HLS and PDFs (gitignored)
├── .data/                    Persistent bundled MongoDB (gitignored)
└── .env.example              Every supported setting, documented
```

---

## Design system

**Ink & Ember** — an editorial, high-contrast visual language; no generic purple gradients or glassmorphism.

| Token | Dark | Light |
|---|---|---|
| Canvas / paper | `#0B0D11` | `#F7F3EA` |
| Surface / card | `#141820`, elevated `#1B2029` | `#FFFFFF` |
| Text / muted | `#E9E5DC` / `#8B909C` | `#14161B` / `#5D626C` |
| Ember (primary) | `#FF6A3D` | `#E2542A` |
| Verdigris (success) | `#5FB3A1` | `#3E7F70` |
| Ochre (ratings) | `#E3B341` | `#B8860B` |

Type: **Fraunces** (display), **Inter** (UI), **JetBrains Mono** (numbers and labels), all bundled via Fontsource. 8-pt spacing, hairline borders, 14 px cards, focus-visible ember rings, reduced-motion support. Course covers are procedural CSS/SVG gradients — no stock imagery required.

---

## Documentation

- [Architecture & data model](docs/architecture.md)
- [API reference](docs/api.md)
- [Test report & performance](docs/test-report.md)
- [10-minute presentation & demo script](docs/demo-script.md)
- [Individual reflections](docs/reflections.md)

---

## Testing and verification

```bash
npm run typecheck   # API + web TypeScript
npm run build       # production web bundle
npm test            # 41/41 API tests
```

Results are recorded in [`docs/test-report.md`](docs/test-report.md):

- **41/41** automated API tests pass (final verification: 5.87 s)
- **41/41** runtime E2E checks pass against the seeded app
- Catalog p95 **5.3 ms**, course detail p95 **4.8 ms**, playback ticket p95 **5.0 ms**
- 360p HLS transcode of the 26 s source: **0.92 s**
- Demo video: 1280×720, 15 fps, 69.6 s H.264

---

## Notes and known constraints

- **Vercel:** set Root Directory to the repository root, Build command `npm run build`, Output directory `apps/web/dist`, Install command `npm install`. `@lumen/shared` is also resolved through a TypeScript path mapping and a Vite alias, so a build from `apps/web` alone works too.
- Prices are stored in **integer cents** everywhere; the UI formats them.
- Certificate completion requires **100% of lessons** (a 90% watch threshold marks an individual video as watched).
- Seed covers and lesson videos are generated locally, so the demo has no third-party asset dependencies.
- Stripe, LiveKit and CloudFront paths compile and are documented, but the default demo intentionally uses their mock/simulated counterparts so no cloud account or keys are required.
- The bundled MongoDB binary is downloaded on first `npm install`; subsequent runs are fully offline.
