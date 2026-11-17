# Lumen Academy — API reference

Base URL: `http://localhost:4000/api/v1` (set `PUBLIC_API_URL` to change).
Health: `GET /health`. Runtime driver config: `GET /api/v1/config`.

## Conventions

### Response envelope

```jsonc
// success
{ "ok": true, "data": <payload> }

// error
{ "ok": false, "error": { "code": "forbidden", "message": "Enrol in this course to continue", "details?: [] } }
```

The web client unwraps `data` in RTK Query's `baseQuery`, so components only see plain DTOs. All error codes and messages come from `lib/errors.ts`.

### Status codes

| Code | Meaning |
|---|---|
| 200 | Success (201 created, 202 accepted/queued) |
| 400 | Validation or business-rule failure (`bad_request`) |
| 401 | Missing/invalid/expired access token (`unauthorized`) |
| 402 | Payment required / card declined (`payment_required`, `card_declined`) |
| 403 | Authenticated but not permitted (`forbidden`) |
| 404 | Not found (`not_found`) |
| 409 | Conflict (`conflict`) — duplicate email, already owns course |
| 429 | Rate limited (`rate_limited`) — auth routes, 40 req/min |

### Authentication

- Send `Authorization: Bearer <accessToken>` on protected routes.
- Access tokens last 15 minutes. The refresh token is an httpOnly cookie named `lumen_refresh` (path `/api/v1/auth`, 7 days).
- `POST /auth/refresh` exchanges the cookie for a new access token. The SPA calls this on load and retries once on 401.
- Roles: `student`, `instructor`, `admin`. `instructor` and `admin` share authoring powers; only `admin` may use `/admin/*`.

### Pagination and filtering

Catalog, admin users and admin courses accept `page`, `pageSize`, `q`, sort/status filters and return `{ items, page, pageSize, total, totalPages }`. Catalog also accepts `category`, `level`, `price=free|paid`, `sort=popular|newest|rating|price_asc|price_desc`, and `mine=1` (instructor only).

### Money and time

All monetary values are **integer cents**; `currency` is `usd`. Timestamps are ISO-8601 strings. Prices are displayed by the client with `formatPrice`.

---

## Auth — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | – | `{ name, email, password, role? }` → `{ user, accessToken }`, 201. Role limited to `student`/`instructor`. |
| POST | `/auth/login` | – | `{ email, password }` → `{ user, accessToken }`; sets refresh cookie. Rejects suspended users. |
| POST | `/auth/refresh` | cookie | Reads `lumen_refresh` → new `{ user, accessToken }`. |
| POST | `/auth/logout` | – | Clears the refresh cookie. |
| GET | `/auth/me` | bearer | Current user DTO + `enrollmentCount`. |
| PATCH | `/auth/me` | bearer | Update name/headline/bio/avatarUrl via `profileSchema`. |

---

## Courses & curriculum — `/courses`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/courses` | optional | Paginated published catalog. Supports all filters above; `mine=1` lists the caller's own courses. |
| GET | `/courses/filters` | – | `{ categories: [{name,count}], levels }` for the filter UI. |
| GET | `/courses/:slug` | optional | Full course DTO with sections and serialized lessons. Accepts a slug **or** an ObjectId. Non-preview lessons are hidden unless enrolled/owner/admin. |
| POST | `/courses` | instructor | Create a draft; `{ title, subtitle?, description?, category, level?, price?, tags?, cover? }`, 201. |
| PATCH | `/courses/:courseId` | instructor | Partial update (validated by `courseInputSchema.partial()`). |
| DELETE | `/courses/:courseId` | instructor | Removes lessons, quizzes, videos, enrollments, progress, live sessions and media files. |
| POST | `/courses/:courseId/publish` | instructor | Requires ≥1 section, ≥1 lesson and ≥40 characters of description. |
| POST | `/courses/:courseId/unpublish` | instructor | Return to draft. |
| GET | `/courses/:courseId/manage` | instructor | Full DTO including all lessons, `quizCount`, `students`, `paymentsMode`. |
| POST | `/courses/:courseId/sections` | instructor | `{ title }`, 201. |
| PATCH | `/courses/:courseId/sections/:sectionId` | instructor | Rename a section. |
| DELETE | `/courses/:courseId/sections/:sectionId` | instructor | Delete section and its lessons/assets. |
| POST | `/courses/:courseId/sections/:sectionId/lessons` | instructor | `{ title, type, body?, durationSec?, isPreview?, order? }`, 201. |
| PATCH | `/courses/:courseId/lessons/:lessonId` | instructor | Partial lesson update; recomputes course stats. |
| DELETE | `/courses/:courseId/lessons/:lessonId` | instructor | Delete lesson and related assets/quiz/progress. |
| PATCH | `/courses/:courseId/reorder` | instructor | `{ sections?: [{id,order}], lessons?: [{id,sectionId,order}] }`. |
| GET | `/courses/:courseId/students` | instructor | Enrolled learners with progress, pricePaid and joined date. |

---

## Media — `/media`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/media/presign` | instructor | `{ courseId, lessonId, filename, contentType?, size? }` → upload ticket (`videoId`, `uploadUrl`, `method`, `headers`, `key`, `maxBytes` 2 GB). Replaces any prior asset on the lesson. |
| POST | `/media/upload/:videoId` | instructor | Multipart `file` upload (local driver). |
| GET | `/media/videos/:videoId` | bearer | `VideoAsset` DTO; owner, admin or enrolled student. |
| POST | `/media/videos/:videoId/process` | instructor | Enqueue HLS transcode → `202 { queued, driver, jobId }`. |
| DELETE | `/media/videos/:videoId` | instructor | Remove asset and files. |
| GET | `/media/playback/:lessonId` | bearer | Authorization + HLS URLs. Denies non-preview lessons without enrollment; sets the `lumen_media` cookie. Non-video lessons return their `body`. |

Static delivery: `GET /media/**` serves HLS manifests, fMP4 segments, posters and certificate files. Requires the `lumen_media` cookie unless `MEDIA_OPEN=true`. Playlists use `max-age=5`; segments/posters `max-age=7d`.

---

## Enrollment & progress — `/api/v1`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/enrollments` | bearer | `{ courseId }`. Free courses enroll instantly; paid courses require a paid order (402 otherwise). Repeated calls are idempotent. |
| GET | `/me/enrollments` | bearer | Learner's enrollments with course DTO, progress and certificate serial. |
| GET | `/courses/:courseId/progress` | bearer | `{ progressPct, lessons[], completedAt, certificateSerial, totalLessons, completedLessons, lastLessonId }`. |
| PATCH | `/progress/:lessonId` | bearer | `{ watchedSeconds, completed? }` → recomputed progress. Requires enrollment. |

A video lesson is marked watched at ≥90% of its duration (`watchedSeconds / durationSec ≥ 0.9`) or when `completed: true` is sent.

---

## Quizzes — `/api/v1`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/courses/:courseId/lessons/:lessonId/quiz` | instructor | Create/replace the quiz attached to a lesson; upserts and sets the lesson type to `quiz`. |
| GET | `/quizzes/:quizId/manage` | instructor | Full quiz incl. answer key. |
| DELETE | `/quizzes/:quizId` | instructor | Delete quiz and its attempts. |
| GET | `/quizzes/:quizId` | bearer | **Sanitized** quiz: no `correct`/`explanation`; includes `attemptsUsed`, `bestScore`, `lastAttemptId`. Owner or enrolled learner only. |
| POST | `/quizzes/:quizId/attempts` | bearer | Start attempt → `{ attemptId, startedAt, expiresAt, attemptNumber, attemptsAllowed }`, 201. Enforces attempt limit. |
| PATCH | `/attempts/:attemptId/submit` | bearer | `{ answers: [{questionId, selected: number[]}] }` → `{ score (0–100), earned, maxScore, passed, breakdown }`. Single submission per attempt; timed attempts expire after `timeLimitSec + 15`. Passing quizzes complete their linked lesson. |
| GET | `/me/attempts` | bearer | Last 100 attempts with quiz and course titles. |

Question types: `single`, `multi`, `truefalse`. Multi-select awards partial credit per correct option.

---

## Certificates — `/api/v1`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/certificates/issue` | bearer | `{ courseId }`. Requires 100% progress; idempotent. 201 with certificate DTO. |
| GET | `/me/certificates` | bearer | All certificates owned by the caller. |
| GET | `/certificates/:serial/download` | bearer | streams `application/pdf`, `Content-Disposition: attachment`. Owner or admin. |
| GET | `/verify/:serial` | – | Public verification → `{ ...certificateDTO, valid: true, issuer: 'Lumen Academy' }`. 404 for unknown serial. |

---

## Live classes — `/live`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/live` | instructor | `{ courseId, title, description?, scheduledAt }` → session with generated `roomName`, 201. |
| GET | `/live/upcoming` | bearer | Sessions for courses the caller teaches or is enrolled in (max 30) with `isHost`. |
| GET | `/live/course/:courseId` | optional | All sessions for a course with `isEnrolled`/`isHost` flags. |
| GET | `/live/:sessionId` | bearer | Session DTO + `isHost`, `mode`. Enrollment/host guard. |
| POST | `/live/:sessionId/token` | bearer | `{ mode, token, url, roomName, isHost }`. LiveKit JWT when configured, otherwise `mode: 'simulated'`. Ended sessions rejected. |
| PATCH | `/live/:sessionId/status` | instructor | `{ status: scheduled|live|ended }`, host only. Writes a system chat message and broadcasts status. |
| GET | `/live/:sessionId/messages` | bearer | Last 150 persisted chat messages. |

### Socket.IO events

Connect with `auth: { token: <accessToken> }`; the server verifies the JWT and user status.

| Event | Direction | Payload / behaviour |
|---|---|---|
| `video:watch` | client → server | `{ videoId }` — join `video:<id>` room for progress updates. |
| `live:join` | client → server | `{ sessionId }`, ack. Rechecks enrollment/host, joins `live:<id>`, broadcasts `live:presence`. |
| `live:leave` | client → server | `{ sessionId }` — leave room. |
| `chat:send` | client → server | `{ sessionId, text }`, ack. Enrollment check, 6 messages / 10 s rate limit, 600 char cap; persists then broadcasts `chat:new`. |
| `chat:new` | server → client | `{ id, userId, userName, text, kind, createdAt }`. |
| `live:presence` | server → client | `{ sessionId, count, user }`. |
| `live:status` | server → client | `{ sessionId, status }` after host changes state. |
| `video:progress` | server → client | `{ videoId, percent, stage }` emitted to `user:<instructorId>` during transcode. |
| `video:failed` | server → client | `{ videoId, error }` to `video:<id>`. |
| `user:<userId>` | room | Auto-joined on connect for progress notifications. |

---

## Payments — `/api/v1`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/payments/config` | – | `{ payments, live, platformFeePct }`. |
| POST | `/payments/checkout` | bearer | `{ courseId }`. Free → instant enrollment; Stripe → `{ mode:'stripe', checkoutUrl, sessionId }`; mock → `{ mode:'mock', orderId, checkoutUrl, amount }`. Rejects if already enrolled. |
| GET | `/payments/orders/:orderId` | bearer | Order status, amount, course summary and `paymentsMode`. Owner or admin. |
| POST | `/payments/orders/:orderId/pay` | bearer | Mock only: `{ card? }`. Default `4242424242424242` succeeds; ending `0002` → 402 `card_declined`. Fulfils order. |
| POST | `/payments/checkout/confirm` | bearer | Stripe only: `{ sessionId }` → retrieve session and fulfil if paid. |
| POST | `/payments/orders/:orderId/refund` | admin | Refund order; reverses ledger entry and removes enrollment/progress. |
| POST | `/api/v1/webhooks/stripe` | signature | Raw body + `stripe-signature`. Handles `checkout.session.completed` (idempotent fulfilment) and `checkout.session.expired` (mark failed). Returns `{ ok:true, received:true }`. |

---

## Instructor analytics — `/instructor`

All routes require `instructor` or `admin`.

| Method | Path | Description |
|---|---|---|
| GET | `/instructor/overview?range=6m|12m|all` | `{ totals:{gross,fees,net,refunds,students,courses,ratingAvg,ratingCount}, monthly[], topCourses[], recentOrders[], range }`. All totals reconcile with the ledger. |
| GET | `/instructor/courses` | Course rows with lesson count, student count, revenue, rating and cover. |
| GET | `/instructor/revenue?months=6` | Monthly `{ month, gross, net, fees }`, reversed entries subtracted. |
| GET | `/instructor/revenue.csv` | CSV of every ledger entry: `order_id,course,student,status,gross_usd,platform_fee_usd,net_usd,available_at`. |
| GET | `/instructor/payouts` | Available ledger entries grouped by month with order counts. |
| GET | `/instructor/students` | Enrolled learners across the instructor's courses (max 300). |
| GET | `/instructor/quizzes/:quizId/analytics` | `{ attempts, passRate, averageScore, distribution[5], perQuestion[] }`; owner only. |

---

## Admin — `/admin`

All routes require `admin`.

| Method | Path | Description |
|---|---|---|
| GET | `/admin/metrics` | `{ students, instructors, courses, published, pending, enrollments, certificates, gross }`. |
| GET | `/admin/users?q=&role=&page=&pageSize=` | Paginated users with `courseCount`, `lastLoginAt`. |
| PATCH | `/admin/users/:userId` | `{ role?, status? }`. Cannot promote to admin (seed-provisioned only); validates role/status values. |
| GET | `/admin/courses?status=&q=` | Moderation list with instructor name/email and stats. |
| PATCH | `/admin/courses/:courseId/status` | `{ status }` — any valid course status. |
| GET | `/admin/orders` | Last 60 orders with course and student names. |

---

## Example: full learner journey (curl)

```bash
# 1. log in
TOKEN=$(curl -s -c cookies.txt -H 'content-type: application/json' \
  -d '{"email":"student@lumen.academy","password":"Password123!"}' \
  http://localhost:4000/api/v1/auth/login | node -pe "JSON.parse(require('fs').readFileSync(0)).data.accessToken")

# 2. browse and open a course
curl -s 'http://localhost:4000/api/v1/courses?page=1&pageSize=6'
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/v1/courses/production-grade-react-architecture

# 3. get a signed playback ticket (also sets the lumen_media cookie)
curl -s -b cookies.txt -c cookies.txt -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/v1/media/playback/<lessonId>

# 4. report progress (90%+ of duration marks the video watched)
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"watchedSeconds":26,"completed":true}' \
  http://localhost:4000/api/v1/progress/<lessonId>

# 5. verify a certificate publicly
curl -s http://localhost:4000/api/v1/verify/<serial>
```

For the complete checked API behaviour see [`tests/api.test.ts`](../apps/api/tests/api.test.ts) and the results in [`test-report.md`](test-report.md).
