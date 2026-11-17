import { useEffect, useRef } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import type { Role } from '@lumen/shared';
import { useAppDispatch, useAppSelector } from './hooks';
import { useRefreshMutation } from './api';
import { markReady, setCredentials } from './authSlice';
import { AppShell } from './components/AppShell';
import { SiteNav } from './components/SiteNav';
import { SiteFooter } from './components/SiteFooter';
import { Spinner } from './components/ui';

import Landing from './pages/Landing';
import Catalog from './pages/Catalog';
import CourseDetail from './pages/CourseDetail';
import Verify from './pages/Verify';
import LivePublic from './pages/LivePublic';
import { LoginPage, RegisterPage } from './pages/Auth';

import Dashboard from './pages/app/Dashboard';
import Player from './pages/app/Player';
import QuizPage from './pages/app/QuizPage';
import Certificates from './pages/app/Certificates';
import Settings from './pages/app/Settings';
import StudentLive from './pages/app/StudentLive';
import LiveRoom from './pages/app/LiveRoom';
import Checkout from './pages/app/Checkout';
import CheckoutSuccess from './pages/app/CheckoutSuccess';

import TeachOverview from './pages/teach/Overview';
import TeachCourses from './pages/teach/Courses';
import CourseEditor from './pages/teach/CourseEditor';
import TeachStudents from './pages/teach/Students';
import TeachPayouts from './pages/teach/Payouts';
import TeachLive from './pages/teach/Live';

import AdminPage from './pages/admin/Admin';

function homeFor(role: Role) {
  if (role === 'admin') return '/admin';
  if (role === 'instructor') return '/teach';
  return '/app';
}

function BootSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-3">
        <Spinner size={22} />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Opening your workspace</p>
      </div>
    </div>
  );
}

function Guard({ roles }: { roles?: Role[] }) {
  const { user, ready } = useAppSelector((state) => state.auth);
  const location = useLocation();

  if (!ready) return <BootSplash />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}

function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAppSelector((state) => state.auth);
  if (ready && user) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

export default function App() {
  const dispatch = useAppDispatch();
  const [refresh] = useRefreshMutation();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    refresh()
      .unwrap()
      .then((result) => dispatch(setCredentials({ user: result.user, token: result.accessToken })))
      .catch(() => dispatch(markReady()));
  }, [dispatch, refresh]);

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Landing />} />
          <Route path="courses" element={<Catalog />} />
          <Route path="courses/:slug" element={<CourseDetail />} />
          <Route path="verify" element={<Verify />} />
          <Route path="verify/:serial" element={<Verify />} />
          <Route path="live" element={<LivePublic />} />
        </Route>

        <Route
          path="login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="register"
          element={
            <GuestOnly>
              <RegisterPage />
            </GuestOnly>
          }
        />

        <Route element={<Guard />}>
          <Route path="live/:sessionId" element={<LiveRoom />} />
          <Route path="checkout/success" element={<CheckoutSuccess />} />
        </Route>

        <Route element={<Guard roles={['student']} />}>
          <Route path="checkout/:orderId" element={<Checkout />} />
        </Route>

        <Route element={<Guard />}>
          <Route element={<AppShell />}>
            <Route path="app" element={<Dashboard />} />
            <Route path="app/courses/:slug" element={<Player />} />
            <Route path="app/courses/:slug/:lessonId" element={<Player />} />
            <Route path="app/quiz/:quizId" element={<QuizPage />} />
            <Route path="app/certificates" element={<Certificates />} />
            <Route path="app/live" element={<StudentLive />} />
            <Route path="app/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route element={<Guard roles={['instructor', 'admin']} />}>
          <Route element={<AppShell />}>
            <Route path="teach" element={<TeachOverview />} />
            <Route path="teach/courses" element={<TeachCourses />} />
            <Route path="teach/courses/:courseId" element={<CourseEditor />} />
            <Route path="teach/students" element={<TeachStudents />} />
            <Route path="teach/payouts" element={<TeachPayouts />} />
            <Route path="teach/live" element={<TeachLive />} />
          </Route>
        </Route>

        <Route element={<Guard roles={['admin']} />}>
          <Route element={<AppShell />}>
            <Route path="admin" element={<AdminPage tab="overview" />} />
            <Route path="admin/users" element={<AdminPage tab="users" />} />
            <Route path="admin/courses" element={<AdminPage tab="courses" />} />
            <Route path="admin/orders" element={<AdminPage tab="orders" />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
