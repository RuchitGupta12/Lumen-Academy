import { createApi, fetchBaseQuery, type BaseQueryFn } from '@reduxjs/toolkit/query/react';
import type {
  AdminMetricsDTO,
  AttemptResultDTO,
  AuthResponse,
  CertificateDTO,
  ChatMessageDTO,
  CourseDTO,
  CourseInput,
  CourseProgressDTO,
  EnrollmentDTO,
  InstructorOverviewDTO,
  LiveSessionDTO,
  LoginInput,
  Paginated,
  QuizDTO,
  RegisterInput,
  UserDTO,
} from '@lumen/shared';
import { clearCredentials, setCredentials, type AuthState } from './authSlice';
import type { RootState } from './store';

export interface PlaybackPayload {
  lessonId: string;
  courseId?: string;
  title?: string;
  hlsUrl?: string;
  posterUrl?: string;
  thumbnailsUrl?: string;
  durationSec?: number;
  body?: string;
  type?: string;
  status?: string;
  progress?: number;
  error?: string | null;
  authorization?: 'local' | 'cloudfront';
}

export interface VideoTicket {
  videoId: string;
  lessonId: string;
  driver: 'local' | 's3';
  method: 'POST' | 'PUT';
  uploadUrl: string;
  headers: Record<string, string>;
  maxBytes: number;
}

export interface CourseListItem {
  id: string;
  title: string;
  slug: string;
  status: CourseDTO['status'];
  price: number;
  category: string;
  lessons: number;
  students: number;
  revenue: number;
  ratingAvg: number;
  updatedAt: string;
  cover: CourseDTO['cover'];
}

export interface LivePayload extends LiveSessionDTO {
  isEnrolled?: boolean;
  isHost?: boolean;
  mode?: 'simulated' | 'livekit';
}

export interface LiveTokenPayload {
  sessionId: string;
  roomName: string;
  isHost: boolean;
  mode: 'simulated' | 'livekit';
  token: string | null;
  url: string | null;
  title: string;
}

export interface OrderPayload {
  id: string;
  status: string;
  amount: number;
  currency: string;
  provider: string;
  providerSessionId?: string | null;
  createdAt: string;
  paymentsMode: 'stripe' | 'mock';
  course: {
    id: string;
    title: string;
    slug: string;
    cover: CourseDTO['cover'];
    instructorName: string;
  } | null;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api/v1',
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  const isAuthCall = typeof args === 'string' ? args.includes('/auth/') : String(args.url).includes('/auth/');
  if (result.error?.status === 401 && !isAuthCall) {
    const refresh = await rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, extraOptions);
    if (refresh.data) {
      const data = refresh.data as { data: AuthResponse };
      api.dispatch(setCredentials({ user: data.data.user, token: data.data.accessToken }));
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      api.dispatch(clearCredentials());
    }
  }
  return result;
};

/** Unwraps the `{ ok, data }` envelope the API always returns. */
const baseQuery: BaseQueryFn = async (args, api, extraOptions) => {
  const result = await baseQueryWithReauth(args, api, extraOptions);
  const payload = result.data as { ok?: boolean; data?: unknown } | undefined;
  if (payload && typeof payload === 'object' && payload.ok === true && 'data' in payload) {
    return { data: payload.data };
  }
  return result;
};

export function errorMessage(error: unknown, fallback = 'Something went wrong') {
  const data = (error as { data?: { error?: { message?: string } } })?.data;
  return data?.error?.message ?? fallback;
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: [
    'Course',
    'Catalog',
    'Enrollment',
    'Progress',
    'Quiz',
    'Instructor',
    'Admin',
    'Live',
    'Order',
    'Certificate',
    'Me',
    'Video',
  ],
  endpoints: (builder) => ({
    /* ── auth ─────────────────────────────────────────────────────────── */
    register: builder.mutation<AuthResponse, RegisterInput>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),
    login: builder.mutation<AuthResponse, LoginInput>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    refresh: builder.mutation<AuthResponse, void>({
      query: () => ({ url: '/auth/refresh', method: 'POST' }),
    }),
    logout: builder.mutation<{ ok: boolean }, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
    me: builder.query<UserDTO & { enrollmentCount: number }, void>({
      query: () => '/auth/me',
      providesTags: ['Me'],
    }),
    updateProfile: builder.mutation<UserDTO, Partial<{ name: string; headline: string; bio: string; avatarUrl: string }>>({
      query: (body) => ({ url: '/auth/me', method: 'PATCH', body }),
      invalidatesTags: ['Me'],
    }),

    /* ── catalog ──────────────────────────────────────────────────────── */
    courses: builder.query<Paginated<CourseDTO>, Record<string, string>>({
      query: (params) => ({ url: '/courses', params }),
      providesTags: ['Catalog'],
    }),
    courseFilters: builder.query<{ categories: Array<{ name: string; count: number }>; levels: string[] }, void>({
      query: () => '/courses/filters',
      providesTags: ['Catalog'],
    }),
    course: builder.query<CourseDTO, string>({
      query: (slug) => `/courses/${slug}`,
      providesTags: (_result, _error, slug) => [{ type: 'Course', id: slug }],
    }),
    manageCourse: builder.query<CourseDTO & { paymentsMode: string; quizCount: number; students: number }, string>({
      query: (id) => `/courses/${id}/manage`,
      providesTags: (_result, _error, id) => [{ type: 'Course', id }],
    }),
    createCourse: builder.mutation<CourseDTO, CourseInput>({
      query: (body) => ({ url: '/courses', method: 'POST', body }),
      invalidatesTags: ['Catalog', 'Instructor'],
    }),
    updateCourse: builder.mutation<CourseDTO, { id: string; body: Partial<CourseInput> }>({
      query: ({ id, body }) => ({ url: `/courses/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Course', id }, 'Catalog', 'Instructor'],
    }),
    publishCourse: builder.mutation<{ status: string }, string>({
      query: (id) => ({ url: `/courses/${id}/publish`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Course', id }, 'Catalog', 'Instructor'],
    }),
    unpublishCourse: builder.mutation<{ status: string }, string>({
      query: (id) => ({ url: `/courses/${id}/unpublish`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Course', id }, 'Catalog', 'Instructor'],
    }),
    deleteCourse: builder.mutation<{ deleted: boolean }, string>({
      query: (id) => ({ url: `/courses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Catalog', 'Instructor'],
    }),
    addSection: builder.mutation<CourseDTO, { courseId: string; title: string }>({
      query: ({ courseId, title }) => ({ url: `/courses/${courseId}/sections`, method: 'POST', body: { title } }),
      invalidatesTags: (_result, _error, { courseId }) => [{ type: 'Course', id: courseId }],
    }),
    renameSection: builder.mutation<CourseDTO, { courseId: string; sectionId: string; title: string }>({
      query: ({ courseId, sectionId, title }) => ({
        url: `/courses/${courseId}/sections/${sectionId}`,
        method: 'PATCH',
        body: { title },
      }),
      invalidatesTags: (_result, _error, { courseId }) => [{ type: 'Course', id: courseId }],
    }),
    deleteSection: builder.mutation<{ deleted: boolean }, { courseId: string; sectionId: string }>({
      query: ({ courseId, sectionId }) => ({
        url: `/courses/${courseId}/sections/${sectionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { courseId }) => [{ type: 'Course', id: courseId }],
    }),
    addLesson: builder.mutation<
      unknown,
      { courseId: string; sectionId: string; title: string; type: string; isPreview?: boolean; body?: string }
    >({
      query: ({ courseId, sectionId, ...body }) => ({
        url: `/courses/${courseId}/sections/${sectionId}/lessons`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { courseId }) => [{ type: 'Course', id: courseId }],
    }),
    updateLesson: builder.mutation<
      unknown,
      { courseId: string; lessonId: string; body: Record<string, unknown> }
    >({
      query: ({ courseId, lessonId, body }) => ({
        url: `/courses/${courseId}/lessons/${lessonId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { courseId }) => [{ type: 'Course', id: courseId }],
    }),
    deleteLesson: builder.mutation<{ deleted: boolean }, { courseId: string; lessonId: string }>({
      query: ({ courseId, lessonId }) => ({
        url: `/courses/${courseId}/lessons/${lessonId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { courseId }) => [{ type: 'Course', id: courseId }],
    }),
    reorder: builder.mutation<
      { reordered: boolean },
      { courseId: string; sections: Array<{ id: string; order: number }>; lessons: Array<{ id: string; sectionId: string; order: number }> }
    >({
      query: ({ courseId, ...body }) => ({ url: `/courses/${courseId}/reorder`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { courseId }) => [{ type: 'Course', id: courseId }],
    }),
    courseStudents: builder.query<
      Array<{
        id: string;
        student: { id: string; name: string; email: string; avatarUrl?: string | null; joinedAt?: string };
        progressPct: number;
        completedAt: string | null;
        pricePaid: number;
        enrolledAt: string;
      }>,
      string
    >({
      query: (courseId) => `/courses/${courseId}/students`,
    }),

    /* ── media ────────────────────────────────────────────────────────── */
    presign: builder.mutation<VideoTicket, { courseId: string; lessonId: string; filename: string; contentType: string; size: number }>({
      query: (body) => ({ url: '/media/presign', method: 'POST', body }),
      invalidatesTags: ['Video'],
    }),
    processVideo: builder.mutation<{ queued: boolean }, string>({
      query: (videoId) => ({ url: `/media/videos/${videoId}/process`, method: 'POST' }),
      invalidatesTags: ['Video'],
    }),
    video: builder.query<
      { id: string; status: string; progress: number; durationSec: number; error?: string | null },
      string
    >({
      query: (videoId) => `/media/videos/${videoId}`,
      providesTags: ['Video'],
    }),
    playback: builder.query<PlaybackPayload, string>({
      query: (lessonId) => `/media/playback/${lessonId}`,
      keepUnusedDataFor: 30,
    }),

    /* ── learning ─────────────────────────────────────────────────────── */
    enroll: builder.mutation<{ enrolled: boolean; enrollmentId?: string }, { courseId: string }>({
      query: (body) => ({ url: '/enrollments', method: 'POST', body }),
      invalidatesTags: ['Enrollment', 'Catalog', 'Progress'],
    }),
    myEnrollments: builder.query<EnrollmentDTO[], void>({
      query: () => '/me/enrollments',
      providesTags: ['Enrollment'],
    }),
    courseProgress: builder.query<
      CourseProgressDTO & { totalLessons: number; completedLessons: number; lastLessonId?: string | null },
      string
    >({
      query: (courseId) => `/courses/${courseId}/progress`,
      providesTags: (_result, _error, courseId) => [{ type: 'Progress', id: courseId }],
    }),
    saveProgress: builder.mutation<
      { lessonId: string; progressPct: number; certificateSerial?: string | null },
      { lessonId: string; watchedSeconds: number; completed?: boolean }
    >({
      query: ({ lessonId, ...body }) => ({ url: `/progress/${lessonId}`, method: 'PATCH', body }),
      invalidatesTags: ['Progress', 'Enrollment'],
    }),
    quiz: builder.query<QuizDTO, string>({
      query: (quizId) => `/quizzes/${quizId}`,
      providesTags: ['Quiz'],
    }),
    startAttempt: builder.mutation<
      { attemptId: string; expiresAt: string | null; attemptNumber: number; attemptsAllowed: number },
      string
    >({
      query: (quizId) => ({ url: `/quizzes/${quizId}/attempts`, method: 'POST' }),
    }),
    submitAttempt: builder.mutation<
      AttemptResultDTO & { earned: number; passingScore: number },
      { attemptId: string; answers: Array<{ questionId: string; selected: number[] }> }
    >({
      query: ({ attemptId, answers }) => ({
        url: `/attempts/${attemptId}/submit`,
        method: 'PATCH',
        body: { answers },
      }),
      invalidatesTags: ['Quiz', 'Progress', 'Enrollment'],
    }),
    saveQuiz: builder.mutation<
      { quizId: string },
      { courseId: string; lessonId: string; body: Record<string, unknown> }
    >({
      query: ({ courseId, lessonId, body }) => ({
        url: `/courses/${courseId}/lessons/${lessonId}/quiz`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { courseId }) => [{ type: 'Course', id: courseId }],
    }),
    manageQuiz: builder.query<Record<string, unknown>, string>({
      query: (quizId) => `/quizzes/${quizId}/manage`,
    }),
    quizAnalytics: builder.query<
      {
        title: string;
        attempts: number;
        passRate: number;
        averageScore: number;
        distribution: Array<{ bucket: string; count: number }>;
        perQuestion: Array<{ questionId: string; prompt: string; answered: number; correct: number; accuracy: number }>;
      },
      string
    >({
      query: (quizId) => `/instructor/quizzes/${quizId}/analytics`,
    }),

    /* ── certificates ─────────────────────────────────────────────────── */
    certificates: builder.query<CertificateDTO[], void>({
      query: () => '/me/certificates',
      providesTags: ['Certificate'],
    }),
    verifyCertificate: builder.query<CertificateDTO & { valid: boolean; issuer: string }, string>({
      query: (serial) => `/verify/${serial}`,
    }),
    downloadCertificate: builder.query<Blob, string>({
      query: (serial) => ({ url: `/certificates/${serial}/download`, responseType: 'blob' }),
      keepUnusedDataFor: 0,
    }),
    issueCertificate: builder.mutation<CertificateDTO, string>({
      query: (courseId) => ({ url: '/certificates/issue', method: 'POST', body: { courseId } }),
      invalidatesTags: ['Certificate', 'Enrollment', 'Progress'],
    }),

    /* ── live ─────────────────────────────────────────────────────────── */
    liveUpcoming: builder.query<LivePayload[], void>({
      query: () => '/live/upcoming',
      providesTags: ['Live'],
    }),
    liveCourse: builder.query<LivePayload[], string>({
      query: (courseId) => `/live/course/${courseId}`,
      providesTags: ['Live'],
    }),
    liveSession: builder.query<LivePayload, string>({
      query: (id) => `/live/${id}`,
      providesTags: ['Live'],
    }),
    liveToken: builder.mutation<LiveTokenPayload, string>({
      query: (id) => ({ url: `/live/${id}/token`, method: 'POST' }),
    }),
    liveMessages: builder.query<ChatMessageDTO[], string>({
      query: (id) => `/live/${id}/messages`,
    }),
    createLive: builder.mutation<LiveSessionDTO, { courseId: string; title: string; scheduledAt: string; description?: string }>({
      query: (body) => ({ url: '/live', method: 'POST', body }),
      invalidatesTags: ['Live'],
    }),
    setLiveStatus: builder.mutation<{ status: string }, { id: string; status: 'scheduled' | 'live' | 'ended' }>({
      query: ({ id, status }) => ({ url: `/live/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: ['Live'],
    }),

    /* ── commerce ─────────────────────────────────────────────────────── */
    checkout: builder.mutation<
      { mode: 'mock' | 'stripe' | 'free'; orderId?: string; checkoutUrl?: string; enrolled?: boolean; courseSlug?: string },
      { courseId: string }
    >({
      query: (body) => ({ url: '/checkout', method: 'POST', body }),
    }),
    order: builder.query<OrderPayload, string>({
      query: (orderId) => `/orders/${orderId}`,
      providesTags: ['Order'],
    }),
    payOrder: builder.mutation<{ paid: boolean; courseSlug: string | null }, { orderId: string; card: string }>({
      query: ({ orderId, ...body }) => ({ url: `/orders/${orderId}/pay`, method: 'POST', body }),
      invalidatesTags: ['Order', 'Enrollment', 'Progress'],
    }),
    confirmCheckout: builder.mutation<{ status: string; courseSlug: string | null }, { sessionId: string }>({
      query: (body) => ({ url: '/checkout/confirm', method: 'POST', body }),
      invalidatesTags: ['Order', 'Enrollment'],
    }),
    appConfig: builder.query<
      { payments: string; live: string; media: string; queue: string; platformFeePct: number; completionThreshold: number },
      void
    >({
      query: () => '/config',
    }),

    /* ── instructor ───────────────────────────────────────────────────── */
    instructorOverview: builder.query<InstructorOverviewDTO, { range?: string }>({
      query: ({ range = '6m' }) => ({ url: '/instructor/overview', params: { range } }),
      providesTags: ['Instructor'],
    }),
    instructorCourses: builder.query<CourseListItem[], void>({
      query: () => '/instructor/courses',
      providesTags: ['Instructor', 'Course'],
    }),
    instructorStudents: builder.query<
      Array<{
        id: string;
        name: string;
        email: string;
        courseId: string;
        courseTitle: string;
        progressPct: number;
        completed: boolean;
        enrolledAt: string;
      }>,
      void
    >({
      query: () => '/instructor/students',
    }),
    instructorPayouts: builder.query<
      Array<{ month: string; gross: number; fee: number; net: number; orders: number }>,
      void
    >({
      query: () => '/instructor/payouts',
    }),
    instructorRevenue: builder.query<Array<{ month: string; gross: number; net: number; fees: number }>, number>({
      query: (months) => ({ url: '/instructor/revenue', params: { months } }),
    }),

    /* ── admin ────────────────────────────────────────────────────────── */
    adminMetrics: builder.query<AdminMetricsDTO, void>({
      query: () => '/admin/metrics',
      providesTags: ['Admin'],
    }),
    adminUsers: builder.query<Paginated<UserDTO & { courseCount: number }>, Record<string, string>>({
      query: (params) => ({ url: '/admin/users', params }),
      providesTags: ['Admin'],
    }),
    adminCourses: builder.query<
      Array<{
        id: string;
        title: string;
        slug: string;
        status: string;
        category: string;
        price: number;
        instructorName: string;
        instructorEmail: string;
        lessons: number;
        enrollments: number;
        updatedAt: string;
      }>,
      Record<string, string>
    >({
      query: (params) => ({ url: '/admin/courses', params }),
      providesTags: ['Admin'],
    }),
    adminOrders: builder.query<
      Array<{ id: string; courseTitle: string; studentName: string; amount: number; status: string; provider: string; createdAt: string }>,
      void
    >({
      query: () => '/admin/orders',
      providesTags: ['Admin'],
    }),
    adminUpdateUser: builder.mutation<UserDTO, { userId: string; body: { role?: string; status?: string } }>({
      query: ({ userId, body }) => ({ url: `/admin/users/${userId}`, method: 'PATCH', body }),
      invalidatesTags: ['Admin'],
    }),
    adminUpdateCourseStatus: builder.mutation<{ status: string }, { courseId: string; status: string }>({
      query: ({ courseId, status }) => ({
        url: `/admin/courses/${courseId}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['Admin', 'Catalog'],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useMeQuery,
  useUpdateProfileMutation,
  useCoursesQuery,
  useCourseFiltersQuery,
  useCourseQuery,
  useManageCourseQuery,
  useCreateCourseMutation,
  useUpdateCourseMutation,
  usePublishCourseMutation,
  useUnpublishCourseMutation,
  useDeleteCourseMutation,
  useAddSectionMutation,
  useRenameSectionMutation,
  useDeleteSectionMutation,
  useAddLessonMutation,
  useUpdateLessonMutation,
  useDeleteLessonMutation,
  useReorderMutation,
  useCourseStudentsQuery,
  usePresignMutation,
  useProcessVideoMutation,
  useVideoQuery,
  usePlaybackQuery,
  useEnrollMutation,
  useMyEnrollmentsQuery,
  useCourseProgressQuery,
  useSaveProgressMutation,
  useQuizQuery,
  useStartAttemptMutation,
  useSubmitAttemptMutation,
  useSaveQuizMutation,
  useManageQuizQuery,
  useQuizAnalyticsQuery,
  useCertificatesQuery,
  useVerifyCertificateQuery,
  useLazyDownloadCertificateQuery,
  useIssueCertificateMutation,
  useLiveUpcomingQuery,
  useLiveCourseQuery,
  useLiveSessionQuery,
  useLiveTokenMutation,
  useLiveMessagesQuery,
  useCreateLiveMutation,
  useSetLiveStatusMutation,
  useCheckoutMutation,
  useOrderQuery,
  usePayOrderMutation,
  useConfirmCheckoutMutation,
  useAppConfigQuery,
  useInstructorOverviewQuery,
  useInstructorCoursesQuery,
  useInstructorStudentsQuery,
  useInstructorPayoutsQuery,
  useInstructorRevenueQuery,
  useAdminMetricsQuery,
  useAdminUsersQuery,
  useAdminCoursesQuery,
  useAdminOrdersQuery,
  useAdminUpdateUserMutation,
  useAdminUpdateCourseStatusMutation,
} = api;

export type { AuthState };
