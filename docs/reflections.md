# Individual reflections

All four workstreams below were owned by **Ruchit Gupta**. Each section documents one area of that work; the prompts at the end can be used for a weekly log.

Ownership split for this project:

| Workstream | Primary areas |
|---|---|
| A · Foundation & platform | Workspaces, shared schemas, auth/RBAC, app shell, design system |
| B · Media & streaming | Upload handshake, FFmpeg pipeline, queue drivers, signed delivery |
| C · Learning & credentials | Curriculum editor, quizzes, progress, certificates |
| D · Realtime, commerce & delivery | Live classes, Socket.IO, payments, revenue, docs & test evidence |

---

## Reflection A — Foundation & platform — Ruchit Gupta

**What I owned.** I set up the npm workspace monorepo and the shared package that holds the Zod schemas, DTO types and domain constants. I built the Mongoose connection layer with its three-step strategy (external URI → attach to a running local mongod → start a bundled persistent instance), the JWT access/refresh pair with an httpOnly refresh cookie, RBAC middleware, the error envelope, helmet/CORS/rate-limit hardening, and the React app shell with guarded routes for the three roles. I also defined the "Ink & Ember" design tokens and the dark/light theme switch.

**What I learned.** The biggest lesson was that sharing validation schemas between the client and server removes an entire category of mismatch bugs: both sides agree on what a valid course or quiz looks like because they import the same file. I also learned how much detail hides in "just add auth" — refreshing a token while an in-flight RTK Query request is pending, distinguishing 401 from 403 correctly, and making the refresh cookie path align with the route it belongs to all needed deliberate design.

**A challenge I solved.** We had no Docker, MongoDB or Redis on the machine. Instead of stopping the project, I made the database start itself with `mongodb-memory-server` on a fixed port with a persistent data directory. The worker attaches to that same port, so seed, API and worker cooperate without external infrastructure. I also had to be careful that the automated tests use their own random-port instance so they never clobber the demo database.

**What I would do differently.** I would write the API contract tests earlier. Several serialization bugs (lesson ids disappearing from course detail) were found late in the build; a thin contract test at the moment the DTO was introduced would have caught them immediately.

---

## Reflection B — Media & streaming — Ruchit Gupta

**What I owned.** I built the video asset lifecycle: the `presign` → multipart upload → `process` handshake, the queue abstraction with an in-process driver and a BullMQ driver, and the FFmpeg worker that probes the source, transcodes the HLS ladder, renders the poster and WebVTT thumbnails, and reports progress over Socket.IO. I also implemented playback authorization — the signed `lumen_media` cookie for local delivery and the CloudFront signed-cookie adapter behind the same interface.

**What I learned.** I went from knowing HLS as "a playlist and some segments" to understanding fMP4 segments, init segments, `independent_segments`, ABR playlist metadata, cache-header strategy (5 seconds for manifests, 7 days for segments), and why byte-range requests matter. I learned to treat FFmpeg as a process to be managed: parse `out_time_ms` for real progress, cap stderr so a failing job cannot exhaust memory, and always finalize the MP4 container gracefully.

**A challenge I solved.** Transcoding 29 lessons independently would have made seeding painfully slow. I kept the pipeline completely real — the seed generates a 26-second gradient clip and runs it through the actual FFmpeg stages once — then clones the resulting ladder to the other assets. The output is genuine HLS, the demo is fast, and the code path used by a real upload is never faked. Benchmarking showed the 360p pass takes **0.92 s**.

**What I would do differently.** I would add stalled-job recovery and resumable multipart uploads from the start. BullMQ retries handle transient worker failure, but a worker killed mid-transcode currently leaves partial segment files until the next run cleans the directory.

---

## Reflection C — Learning & credentials — Ruchit Gupta

**What I owned.** I built the curriculum editor (sections, lessons, ordering, publish rules), the quiz builder and grading service, progress tracking with the 90% watch threshold, and the PDF certificate generator with public verification. I also wrote the quiz analytics endpoint that produces the score distribution and per-question accuracy used by the instructor dashboard.

**What I learned.** I learned to think about trust boundaries. The client must never receive the answer key, so the student DTO explicitly strips `correct` and `explanation`, and grading re-reads the quiz from MongoDB at submission time. I also learned that "progress" is a policy decision, not just arithmetic: a video counts at 90% watched, a passing quiz completes its lesson, and course completion requires every lesson — which is stricter than the brief's 90% completion threshold and therefore clearly documented.

**A challenge I solved.** Certificate issuance had to be idempotent and safe under duplicate completion events. I keyed it on `(student, course)` and made `issueCertificate` return the existing document, so a replayed progress update or manual issue never produces a second PDF or serial. The QR code encodes the public verify URL, which closes the loop between the physical certificate and the platform.

**What I would do differently.** I would add unit tests for every question-type combination (single, multi, true-false, partial credit, timer expiry) rather than exercising them only through the integration path. The current 41-test suite covers the main path well but could go deeper on edge cases.

---

## Reflection D — Realtime, commerce & delivery — Ruchit Gupta

**What I owned.** I built the live-class flow (scheduling, role-scoped room tokens, the simulated and LiveKit paths), Socket.IO authentication, rooms, presence and persisted chat, and the payments slice: mock checkout, Stripe Checkout with a signed webhook, the idempotent order-to-ledger flow, refunds, and the instructor revenue dashboard with CSV export. I also assembled the documentation, test report, presentation outline and demo recording.

**What I learned.** The most valuable pattern was funnelling both payment drivers through one `fulfillOrder` function. Mock checkout and a verified Stripe webhook produce exactly the same order → enrollment → ledger side effects, so the two paths cannot drift. I also learned how to make a WebRTC feature demoable without an account: the token service returns `mode: 'simulated'`, and the client lazy-loads the heavy LiveKit stage only when a real token exists, so the camera preview and realtime chat still tell the story offline.

**A challenge I solved.** Testing exposed a subtle MongoDB index bug: a sparse unique index still indexes documents whose field is explicitly `null`, so the second mock order (no Stripe session) was rejected. Switching to a partial index filtered on `{ $type: 'string' }` enforces uniqueness where it matters without blocking mock orders. I also had to finalize the demo MP4 gracefully — killing FFmpeg outright produces a file with no `moov` atom.

**What I would do differently.** I would capture the demo video earlier and in shorter scenes. Re-recording a long session after every UI tweak was expensive; a scene-per-file approach with a simple concat step would have made iteration much cheaper.

---

## Reflection prompts (for weekly logs)

1. **Ownership:** Which files or features were unmistakably yours? Name one decision you made that someone else would have made differently.
2. **Learning:** What did you understand at the end of the project that you could not explain at the start? Be concrete — name a technology, a protocol or a design principle.
3. **Challenge:** Describe one bug or design dead-end that cost you more than an hour. What was the root cause, and what changed because of it?
4. **Collaboration:** Where did your work depend on someone else's, and how did you keep the interfaces stable (shared schemas, DTOs, documented endpoints)?
5. **Evidence:** Point to one test, benchmark or demo moment that proves your part works.
6. **Next time:** What would you build first if you had one more day, and what would you delete?

---

## Team-level reflection

I deliberately chose breadth with depth in the hard places: every milestone in the brief has a working, testable implementation, and the two most technically risky areas — real HLS transcoding and idempotent payments — were given shared service layers rather than driver-specific shortcuts. The driver architecture was the key decision: it let me demo everything locally while still writing the CloudFront, BullMQ, Stripe and LiveKit code paths. The trade-off is that those production paths are exercised by compilation and code review rather than live cloud integration tests; that is the first thing I would add with real credentials and a staging environment.
