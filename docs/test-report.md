# Lumen Academy — Test report & performance

## 1. Summary

| Verification | Result | Evidence |
|---|---|---|
| TypeScript (API + web) | ✅ Pass | `npm run typecheck` — no errors |
| Production build | ✅ Pass | `npm run build` — Vite bundle emitted with code splitting |
| Automated API suite | ✅ **41 / 41 pass** | `npm test` — Vitest + Supertest, 5.87 s final run |
| Runtime E2E checks | ✅ **41 / 41 pass** | CDP/HTTP harness against the seeded app |
| Performance benchmark | ✅ All targets met | 60 requests/endpoint, local bundled MongoDB |
| Transcode benchmark | ✅ 0.92 s | 360p HLS, 26 s source, bundled FFmpeg |
| Screen-recorded demo | ✅ Valid MP4 | 1280×720, 15 fps, 69.6 s H.264 |

Test environment: Node `v24.15.0`, npm `11.12.1`, Windows 11, bundled `mongodb-memory-server` (WiredTiger), bundled `ffmpeg-static` / `ffprobe-static`. No Docker, system MongoDB, Redis or system FFmpeg was used.

---

## 2. Automated API suite

`apps/api/tests/api.test.ts` boots an **isolated** `MongoMemoryServer` on a random port, sets `MONGODB_URI` before importing the app, and drives the real Express app over HTTP with `fetch`. It creates its own users, course, lessons, video asset, quiz and enrollment, so it is fully independent of the seeded demo database and can run while the dev server is up.

```bash
npm test
```

```
 ✓ tests/api.test.ts (41 tests) 5870ms
 Test Files  1 passed (1)
      Tests  41 passed (41)
   Duration  5.87s (tests 99%, transform 1%)
```

### Coverage by area

| Area | # | Representative assertions |
|---|---:|---|
| Platform health | 2 | `/health` reports all four drivers; `/config` reports fee and completion threshold |
| Authentication | 5 | Register (201), duplicate email (409), wrong password (401), `/me`, refresh-cookie rotation |
| Catalog & courses | 4 | Paginated list, category filter, serialized lesson DTOs (`id`, `quizId`, HLS URL), unknown slug 404 |
| Enrollment & progress | 7 | Enroll, idempotent repeat, my enrollments, progress gate, 50% then 100%, auto-certificate, no-enrollment 403 |
| Quizzes | 3 | Sanitized fetch, attempt → submit → 100% score / passed, attempt history |
| Certificates | 3 | PDF `%PDF` header + `application/pdf`, public verify by serial, unknown serial 404 |
| Media playback | 2 | Signed ticket + cookie for preview lesson, 403 for non-preview without enrollment |
| Payments (mock) | 3 | Pending order, decline card `...0002` → 4xx, success card → paid + enrollment |
| Instructor analytics | 3 | Overview totals, course list, students and payouts |
| Live classes | 4 | Schedule, upcoming list, simulated token, start → system chat → end |
| Admin | 5 | Metrics, users/courses/orders, student 403, instructor 403, anonymous 401 |
| **Total** | **41** | |

All 41 tests pass after the final `providerSessionId` partial-index fix.

---

## 3. Runtime E2E checks

A second harness drove the **seeded, running application** end to end over HTTP + Chrome DevTools Protocol: 41 checks covering the same flows through the real seed data rather than fixtures.

| Flow | Checks | What was exercised |
|---|---:|---|
| Auth | 5 | Login for all four roles, cookie issuance, refresh, `/me`, logout |
| Catalog & detail | 5 | Six published courses, filters, slug detail, lesson visibility for guests vs enrolled |
| Enrollment | 4 | Owned-course access, free-path guard, paid-course 402 without order, idempotency |
| Playback | 5 | Ticket issuance, `lumen_media` cookie, `/media` 403 without cookie, 200 with cookie, HLS manifest served |
| Progress | 5 | Watch threshold, explicit completion, percentage rollup, resume lesson, completion timestamp |
| Quiz | 4 | Sanitized questions, attempt limit, grading, passed quiz completing its lesson |
| Certificate | 4 | Auto-issue, PDF download, public verify, unknown serial 404 |
| Payments | 4 | Fresh-user checkout, decline card, success card, enrollment granted after payment |
| Instructor / live / admin | 4 | Revenue overview, course/student lists, live token + status, admin RBAC |
| **Total** | **41** | |

Result: **41 / 41 pass**.

---

## 4. Performance

Benchmark script: 5 warm-up requests + 60 measured requests per endpoint against the running API with its bundled MongoDB (single process, local loopback). Latency includes Express routing, Mongoose queries, DTO serialization and JSON encoding.

### API latency

| Endpoint | Requests | Mean | p50 | **p95** | Max |
|---|---:|---:|---:|---:|---:|
| `GET /health` | 60 | 0.8 ms | 0.6 ms | **1.9 ms** | 5.8 ms |
| `GET /api/v1/courses` | 60 | 4.6 ms | 4.5 ms | **5.3 ms** | 5.5 ms |
| `GET /api/v1/courses/:slug` | 60 | 4.1 ms | 4.1 ms | **4.8 ms** | 5.5 ms |
| `GET /api/v1/me/enrollments` | 60 | 4.4 ms | 4.2 ms | **5.3 ms** | 9.1 ms |
| `GET /api/v1/courses/:id/progress` | 60 | 3.3 ms | 3.0 ms | **4.2 ms** | 17.6 ms |
| `GET /api/v1/media/playback/:lessonId` | 60 | 3.9 ms | 3.8 ms | **5.0 ms** | 5.3 ms |

All catalog/detail/playback endpoints are comfortably below the 150 ms p95 target from the brief — roughly 28–30× faster on this machine. The single 17.6 ms progress outlier is a one-off GC/event-loop pause; p95 stays at 4.2 ms.

### Transcode throughput

| Input | Operation | Time | Output |
|---|---|---:|---|
| 26 s, 1280×720 gradient clip | 360p fMP4 HLS rendition (`libx264 -preset veryfast -crf 28 -hls_time 4`) | **0.92 s** | 7 files, 0.3 MB |

The production pipeline (`services/videoProcess.ts`) uses `-crf 23`, per-rendition bitrate caps, a poster frame and a 10-thumbnail WebVTT track. The seed encodes this source once through the real pipeline and clones the resulting ladder to the other 28 video lessons, which keeps seeding fast without faking media.

### Production bundle

| Chunk | Raw | Gzip | Loaded when |
|---|---:|---:|---|
| `index-*.js` (app shell + all pages) | 723.38 kB | 207.96 kB | Every page |
| `LiveKitStage` | 650.39 kB | 176.19 kB | Only a `livekit`-mode live room |
| `hls.js` | 579.11 kB | 180.74 kB | Only the lesson player |

Route-level lazy loading keeps the WebRTC and HLS libraries out of the initial page load for users who never open those routes.

---

## 5. Recorded demo

| Property | Value |
|---|---|
| File | `docs/demo/lumen-academy-demo.mp4` |
| Codec | H.264 (yuv420p) |
| Resolution / framerate | 1280 × 720 @ 15 fps |
| Duration | 69.6 s |
| Size | 686,510 bytes (~0.65 MiB) |
| Capture method | Chrome via CDP + bundled FFmpeg `gdigrab`, 1280-wide scaling, `libx264 -crf 24`, `+faststart` |

Scenes: landing → student dashboard → catalog → course detail → HLS player → quiz → instructor overview → course management → live classes → admin console. Each scene carries an on-screen caption naming the feature being demonstrated. See [`demo-script.md`](demo-script.md) for the full shot list and presentation timing.

---

## 6. Defects found and fixed during testing

| Symptom | Root cause | Fix |
|---|---|---|
| Second mock checkout returned 409 "That record already exists" | Sparse unique index on `providerSessionId` indexes explicit `null` values used by mock orders | Replaced with a partial unique index filtered to `{ $type: 'string' }` (`apps/api/src/models/commerce.ts`) |
| Quiz questions missing `id` / `quizId` in course detail | Double serialization of already-serialized lesson DTOs | `courseToDTO` now passes pre-serialized lessons through unchanged (`apps/api/src/lib/serialize.ts`) |
| Refresh test failed reading `set-cookie` | Node `fetch` returns a comma-joined header, not an array | Test normalizes both header shapes before extracting the cookie |
| Score assertion expected 1 but got 100 | Grading reports a 0–100 percentage by design | Test updated to the documented contract; grading logic unchanged |
| Direct enrollment on a paid course returned 402 | Correct behaviour — checkout is required first | Test fixture now creates a paid `Order` before enrolling |
| Demo MP4 had no `moov` atom | ffmpeg was killed before finalizing | Recorder now sends `q` to stdin and waits for a clean exit |
| Certificate generator had a duplicate `QRCode` import | Copy/paste artifact | Removed duplicate import |

---

## 7. Reproducing the verification

```bash
npm install
npm test                 # 41/41 API tests, isolated DB
npm run typecheck        # no errors
npm run build            # production web bundle

npm run seed             # restore demo data (stop the API first)
npm run dev              # start API + web
# open http://localhost:5173, or watch docs/demo/lumen-academy-demo.mp4
```

> The automated tests never touch the persistent `.data/mongo` database used by the demo — they start their own random-port MongoDB instance — so it is safe to run `npm test` while the dev servers are running.
