# Lumen Academy — 10-minute presentation & demo script

This document has two parts:

1. **Presentation outline** — a timed 10-minute narrative for the final submission (problem → design → challenges → results → next steps).
2. **Demo script / shot list** — the exact sequence recorded in `docs/demo/lumen-academy-demo.mp4`, with what to click and what to say at each beat.

Both are designed to be delivered from a single machine with `npm run dev` running and the seed data loaded.

---

## Part 1 — 10-minute presentation outline

### 0:00–0:50 · Problem & thesis

> "Most course platforms teach one thing and hide the rest. We built Lumen Academy to put the whole learning lifecycle in one place — authoring, real video delivery, assessment, live teaching, proof of completion, and getting paid — and to make it runnable on a laptop with no cloud account."

Points:

- Audience pain: fragmented tools, opaque progress, fake 'video player' demos, certificates that cannot be verified.
- Our answer: one MERN app with a driver architecture — every external dependency has a self-contained local default.
- State the deliverable up front: full app + tests + docs + this 70-second recording.

### 0:50–2:00 · Architecture in one slide

Use the Mermaid diagram from [`architecture.md`](architecture.md#1-system-overview) or describe it verbally:

- React 19 + Redux Toolkit / RTK Query → Express 5 REST + Socket.IO → MongoDB.
- FFmpeg worker produces HLS; CloudFront/local driver delivers it.
- Stripe, LiveKit and S3/CloudFront are adapters, not hard dependencies.
- Single source of truth: `packages/shared` Zod schemas imported by both sides.

> "Six driver switches — database, media, queue, payments, live, and HLS ladder — mean the demo works offline and the same code paths are production-ready."

### 2:00–3:20 · Roles, courses & authoring

- Three roles with real RBAC, not just a UI toggle: students enroll and learn; instructors author and analyze; admins moderate.
- Course editor: sections → lessons (video/text/quiz), drag reorder, publish rules (≥1 section, ≥1 lesson, ≥40-char description).
- Catalog: search, category/level/price filters, five sort modes, pagination, enrollment-aware lesson visibility.

### 3:20–5:00 · The video pipeline (the technical centrepiece)

> "This is not a placeholder `<video>` tag pointed at a stock MP4."

Walk the lifecycle:

1. `presign` creates a `VideoAsset` and upload ticket; multipart upload lands in `media/uploads`.
2. `process` enqueues a job — in-process for the demo, BullMQ + Redis in production, with 3 retries and exponential backoff.
3. Worker runs `ffprobe`, then real FFmpeg: 360p/720p fMP4 HLS, `master.m3u8`, poster, 10-thumbnail WebVTT track.
4. Progress parsed from ffmpeg output is pushed over Socket.IO to the editor's progress bar.
5. Playback is authorized first, then a signed `lumen_media` cookie gates the segments; in S3 mode the same call issues CloudFront signed cookies.

Numbers to quote: **0.92 s** to transcode the 26 s source at 360p; **p95 5.0 ms** for a playback ticket.

### 5:00–6:20 · Assessment, progress & certificates

- Quizzes are fetched without the answer key; grading happens server-side with partial credit for multi-select, attempt limits and timers.
- Progress uses a 90% watch threshold per video; course percentage is recomputed from completed lessons.
- At 100% a certificate is issued automatically: A4 PDF, serial, QR → public `/verify/:serial`. Idempotent, downloadable, verifiable by anyone.

### 6:20–7:40 · Live classes

- Instructors schedule a room; `roomName` is deterministic; token endpoint checks enrollment and role.
- LiveKit path issues a 2-hour JWT with publish/subscribe grants; the web stage lazy-loads only in this mode.
- Simulated path gives a local camera preview plus Socket.IO chat and presence persisted to MongoDB.
- Status changes broadcast `live:status` and write a system chat message.

### 7:40–8:40 · Payments & instructor revenue

- Mock checkout: `4242…4242` pays, `…0002` declines — no real money.
- Stripe path: Checkout Session + signed webhook into the **same** idempotent `fulfillOrder` function; duplicate webhooks never double-enroll.
- 20% platform fee ledger: gross / fee / net, monthly aggregation, CSV export, refund reversal.
- Instructor dashboard reconciles KPIs, area chart, top courses, payout ledger with that ledger.

### 8:40–9:30 · Results & verification

Quote the numbers from [`test-report.md`](test-report.md):

| Metric | Result |
|---|---|
| Automated API tests | **41 / 41 pass** (~4.3 s) |
| Runtime E2E checks | **41 / 41 pass** |
| Typecheck + production build | Pass |
| Catalog p95 / course detail p95 | 5.3 ms / 4.8 ms |
| 360p HLS transcode | 0.92 s |
| Demo video | 69.6 s, 720p H.264 |

Mention the two real bugs tests caught: the mock-order unique-index collision and the double-serialized lesson DTO.

### 9:30–10:00 · Challenges & next steps

**Challenges we solved**

- No Docker/Mongo/Redis/system FFmpeg → bundled binaries and driver fallbacks.
- Signed media without a CDN → HMAC cookie with the same URL shape as CloudFront.
- Keeping answer keys off the client → sanitized DTOs and server-side grading.
- Idempotent money movement → one fulfilment path shared by webhook and mock.

**Next steps**

- Multipart resumable uploads and stalled-job recovery for large files.
- Cloud deployment: Atlas + S3/CloudFront + BullMQ workers + LiveKit + Stripe live keys behind the existing switches.
- Deeper quiz analytics (distractor analysis), cohort retention, and accessibility audit automation.

> Closing line: "Every feature in the brief is implemented, tested and demoable — and it all runs from `npm run dev`."

---

## Part 2 — Demo script / shot list

The recording is 69.6 seconds. Each shot holds ~3.5–4.2 seconds with a caption overlay naming the feature. Reproduce it with `npm run dev` + `npm run seed`, then sign in as each role in the browser.

| # | Time | Route | On-screen caption | What to show / say |
|---:|---|---|---|---|
| 1 | 0:00–0:04 | `/` | **Learn craft, not just content.** | Landing page, hero and course cards. "One platform for the full learning lifecycle." |
| 2 | 0:04–0:08 | login → `/app` | **Student dashboard** | Sign in as `student@lumen.academy`. Point at the progress ring and continue-learning rail. |
| 3 | 0:08–0:12 | `/catalog` | **Course catalogue** | Search box and category chips. "Six published courses, filterable and paginated." |
| 4 | 0:12–0:16 | `/courses/production-grade-react-architecture` | **Course detail** | Curriculum sections, preview lesson, price. "Enrolled learners see every lesson; guests see previews." |
| 5 | 0:16–0:20 | `/app/courses/production-grade-react-architecture` | **HLS video player** | Player loads through a signed ticket. "Real FFmpeg HLS ladder, cookie-gated segments, scrub thumbnails." |
| 6 | 0:20–0:24 | `/app/quiz/:quizId` | **Quizzes** | Question list and timer. "No answers leak to the browser; grading is server-side." |
| 7 | 0:24–0:28 | login → `/teach` | **Instructor overview** | KPI cards and revenue chart. "Revenue reconciles with the ledger." |
| 8 | 0:28–0:32 | `/teach/courses` | **Course management** | Course table with status, students, revenue. "Draft → publish, with authoring and media tooling." |
| 9 | 0:32–0:36 | `/teach/live` | **Live classes** | Upcoming sessions and room controls. "Schedule, tokenize, start; chat and presence are realtime." |
| 10 | 0:36–0:40 | login → `/admin` | **Admin console** | Platform metrics and user table. "Strict role guards on every admin route." |
| 11 | 0:40–0:43 | any | **That's Lumen Academy.** | Closing caption: MERN · FFmpeg HLS · BullMQ · LiveKit · Stripe · Redux Toolkit · Vitest |

### Live narration cues

- **Shot 1:** keep it short — the UI should speak; mention the "Ink & Ember" theme.
- **Shot 2:** emphasize that data is seeded and progress is real, not mocked.
- **Shot 5:** this is the technical high point — say the exact FFmpeg flags if the audience is technical (`fmp4`, `independent_segments`, `hls_time 4`).
- **Shot 6:** note attempt limits and that a passed quiz completes its lesson.
- **Shot 7:** call out the 20% platform fee and monthly chart.
- **Shot 10:** note that a student hitting this URL is redirected by the route guard.

### If presenting live instead of playing the video

1. Keep the mock drivers on (`local` / `mock` / `simulated`) — nothing can fail due to missing keys.
2. Have `npm run seed` run immediately before the session so progress and certificates are populated.
3. Keep a second browser profile handy for the "fresh user checkout" moment; the demo student already owns every published course.
4. Use `4242 4242 4242 4242` for success and a card ending `0002` for the decline path.
5. If the camera permission prompt blocks the live-room preview, use the simulated mode explanation rather than waiting on it.
6. Fallback for any network issue: `docs/demo/lumen-academy-demo.mp4` covers the same story in 70 seconds.

### Reproducing the recording

The MP4 was captured with Chrome driven over the DevTools Protocol while bundled FFmpeg recorded the desktop:

```bash
npm run dev        # API + web
npm run seed       # if needed (stop API first, then restart)
# record with a CDP driver of your choice + ffmpeg-static gdigrab:
#   ffmpeg -f gdigrab -framerate 15 -i desktop -vf scale=1280:-2 \
#     -c:v libx264 -preset veryfast -crf 24 -pix_fmt yuv420p -movflags +faststart demo.mp4
```

Send `q` to ffmpeg's stdin to finalize the MP4 container (killing the process leaves it unreadable).
