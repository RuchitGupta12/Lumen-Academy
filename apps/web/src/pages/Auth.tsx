import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, GraduationCap, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { errorMessage, useLoginMutation, useRegisterMutation } from '../api';
import { setCredentials } from '../authSlice';
import { useAppSelector } from '../hooks';
import { api } from '../api';
import { Badge, Button, Field, Input, Select } from '../components/ui';
import { BrandMark } from '../components/SiteNav';
import { useToast } from '../components/Toast';
import { cn } from '../lib/format';

function safeNext(value: string | null) {
  if (!value) return null;
  return value.startsWith('/') && !value.startsWith('//') ? value : null;
}

function AuthAside({ mode }: { mode: 'login' | 'register' }) {
  return (
    <aside className="grain relative hidden overflow-hidden border-r border-line bg-[color-mix(in_oklab,var(--c-surface)_62%,var(--c-canvas))] lg:flex lg:flex-col lg:justify-between lg:p-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 55% at 20% 12%, rgba(255,106,61,0.14), transparent 68%), radial-gradient(50% 50% at 85% 90%, rgba(95,179,161,0.1), transparent 70%)',
        }}
      />
      <div className="relative">
        <Link to="/">
          <BrandMark size={30} />
        </Link>
      </div>

      <div className="relative max-w-md">
        <p className="label-caps mb-4">{mode === 'login' ? 'Welcome back' : 'Your next craft starts here'}</p>
        <h2 className="text-[clamp(1.9rem,3.2vw,2.7rem)] leading-[1.06] text-ink">
          {mode === 'login' ? (
            <>
              Pick up where you
              <br />
              left <span className="italic text-ember">off.</span>
            </>
          ) : (
            <>
              Learn the work,
              <br />
              not just the <span className="italic text-ember">syntax.</span>
            </>
          )}
        </h2>
        <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
          {mode === 'login'
            ? 'Your courses, live rooms, quiz results and certificates are exactly where you left them.'
            : 'Studio-grade video, live critique and graded assessments from people who ship the work.'}
        </p>

        <ul className="mt-8 space-y-3.5">
          {[
            { icon: Sparkles, text: 'Adaptive HLS video with hand-crafted gradings' },
            { icon: UserRound, text: 'Live critique rooms with realtime chat' },
            { icon: ShieldCheck, text: 'Certificates with a public verification serial' },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[12.5px] text-muted">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ember">
                <Icon size={14} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
        <span className="h-px w-8 bg-line-strong" />
        MERN reference implementation · demo build
      </div>
    </aside>
  );
}

function SocialHint() {
  return (
    <div className="rounded-lg border border-line bg-[color-mix(in_oklab,var(--c-surface)_60%,var(--c-canvas))] p-3">
      <p className="label-caps mb-1.5">Demo accounts · password <span className="text-ink">Password123!</span></p>
      <div className="flex flex-wrap gap-1.5 font-mono text-[10px] text-muted">
        <span className="rounded border border-line px-1.5 py-0.5">student@lumen.academy</span>
        <span className="rounded border border-line px-1.5 py-0.5">maya@lumen.academy</span>
        <span className="rounded border border-line px-1.5 py-0.5">admin@lumen.academy</span>
      </div>
    </div>
  );
}

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = useToast();
  const { user } = useAppSelector((state) => state.auth);
  const [login, { isLoading }] = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });

  const next = safeNext(params.get('next'));

  useEffect(() => {
    if (user) navigate(next ?? (user.role === 'admin' ? '/admin' : user.role === 'instructor' ? '/teach' : '/app'), { replace: true });
  }, [user, next, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await login(form).unwrap();
      dispatch(setCredentials({ user: result.user, token: result.accessToken }));
      toast.success(`Welcome back, ${result.user.name.split(' ')[0]}`);
      navigate(next ?? (result.user.role === 'admin' ? '/admin' : result.user.role === 'instructor' ? '/teach' : '/app'), { replace: true });
    } catch (error) {
      toast.error('Sign in failed', errorMessage(error, 'Check your email and password'));
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
      <AuthAside mode="login" />
      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <Link to="/"><BrandMark size={28} /></Link>
          </div>
          <Badge tone="ember" dot>Sign in</Badge>
          <h1 className="mt-4 text-[32px] leading-none text-ink">Welcome back.</h1>
          <p className="mt-2 text-[13px] text-muted">Enter your details to open your workspace.</p>

          <form onSubmit={(event) => void submit(event)} className="mt-7 space-y-4">
            <Field label="Email address" htmlFor="login-email" required>
              <div className="relative">
                <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
                  placeholder="you@example.com"
                  className="pl-9"
                />
              </div>
            </Field>
            <Field label="Password" htmlFor="login-password" required>
              <div className="relative">
                <LockKeyhole size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={(event) => setForm((f) => ({ ...f, password: event.target.value }))}
                  placeholder="••••••••"
                  className="px-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((show) => !show)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>

            <Button type="submit" variant="primary" size="lg" block loading={isLoading} iconRight={<ArrowRight size={16} />}>
              Sign in
            </Button>
          </form>

          <p className="mt-5 text-center text-[12.5px] text-muted">
            New here?{' '}
            <Link to={next ? `/register?next=${encodeURIComponent(next)}` : '/register'} className="text-ember hover:underline">
              Create an account
            </Link>
          </p>

          <div className="mt-8">
            <SocialHint />
          </div>
          <p className="mt-6 text-center">
            <Link to="/" className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint hover:text-muted">
              ← Back to Lumen Academy
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export function RegisterPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = useToast();
  const [register, { isLoading }] = useRegisterMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' as 'student' | 'instructor' });

  const next = safeNext(params.get('next'));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await register(form).unwrap();
      dispatch(setCredentials({ user: result.user, token: result.accessToken }));
      dispatch(api.util.resetApiState());
      toast.success('Account created', 'Welcome to Lumen Academy.');
      navigate(next ?? (result.user.role === 'instructor' ? '/teach' : '/app'), { replace: true });
    } catch (error) {
      toast.error('Could not create account', errorMessage(error));
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
      <AuthAside mode="register" />
      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <Link to="/"><BrandMark size={28} /></Link>
          </div>
          <Badge tone="verdigris" dot>Create account</Badge>
          <h1 className="mt-4 text-[32px] leading-none text-ink">Start learning.</h1>
          <p className="mt-2 text-[13px] text-muted">Free to join. No card needed to get going.</p>

          <form onSubmit={(event) => void submit(event)} className="mt-7 space-y-4">
            <Field label="Full name" htmlFor="reg-name" required>
              <div className="relative">
                <UserRound size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <Input
                  id="reg-name"
                  required
                  value={form.name}
                  onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
                  placeholder="Ada Lovelace"
                  className="pl-9"
                />
              </div>
            </Field>
            <Field label="Email address" htmlFor="reg-email" required>
              <div className="relative">
                <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <Input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
                  placeholder="you@example.com"
                  className="pl-9"
                />
              </div>
            </Field>
            <Field label="Password" htmlFor="reg-password" required hint="At least 8 characters">
              <div className="relative">
                <LockKeyhole size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <Input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(event) => setForm((f) => ({ ...f, password: event.target.value }))}
                  placeholder="••••••••"
                  className="px-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((show) => !show)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
            <Field label="I'm joining as" htmlFor="reg-role">
              <Select id="reg-role" value={form.role} onChange={(event) => setForm((f) => ({ ...f, role: event.target.value as typeof f.role }))}>
                <option value="student">Learner — take courses &amp; earn certificates</option>
                <option value="instructor">Instructor — create courses &amp; teach live</option>
              </Select>
            </Field>

            <Button type="submit" variant="primary" size="lg" block loading={isLoading} iconRight={<ArrowRight size={16} />}>
              Create my account
            </Button>
          </form>

          <p className="mt-5 text-center text-[12.5px] text-muted">
            Already have an account?{' '}
            <Link to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="text-ember hover:underline">
              Sign in
            </Link>
          </p>
          <p className={cn('mt-6 text-center font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint')}>
            Demo build · payments run in test mode
          </p>
        </div>
      </main>
    </div>
  );
}
