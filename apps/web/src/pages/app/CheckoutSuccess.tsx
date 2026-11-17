import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CheckCircle2, Loader2, PartyPopper } from 'lucide-react';
import { useConfirmCheckoutMutation } from '../../api';
import { Badge, Button, Spinner } from '../../components/ui';

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const [confirm, { isLoading }] = useConfirmCheckoutMutation();
  const [status, setStatus] = useState<'checking' | 'done' | 'error'>('checking');
  const started = useRef(false);
  const course = params.get('course') ?? '';
  const sessionId = params.get('session_id');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!sessionId) {
      setStatus('done');
      return;
    }
    void confirm({ sessionId })
      .unwrap()
      .then(() => setStatus('done'))
      .catch(() => setStatus('error'));
  }, [confirm, sessionId]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
      <div className="animate-rise">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-verdigris/40 bg-verdigris/10 text-verdigris">
          {status === 'checking' ? <Loader2 size={34} className="animate-spin" /> : status === 'error' ? <BadgeCheck size={34} /> : <PartyPopper size={34} />}
        </span>

        <Badge tone="verdigris" dot className="mt-6">Payment complete</Badge>
        <h1 className="mt-5 text-[clamp(2rem,4vw,2.8rem)] leading-none text-ink">
          {status === 'checking' ? 'Confirming…' : 'You’re in.'}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[13.5px] leading-relaxed text-muted">
          {status === 'checking'
            ? 'Checking the payment with our gateway. This only takes a moment.'
            : status === 'error'
              ? 'We could not confirm the session automatically. If you were charged, the course will appear in your library shortly — contact support if it does not.'
              : 'Your course is unlocked and ready. Jump straight into the first lesson, or find it later in your dashboard.'}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {course ? (
            <Link to={`/courses/${course}`}>
              <Button variant="primary" size="lg" iconRight={<ArrowRight size={16} />}>Go to course</Button>
            </Link>
          ) : (
            <Link to="/app"><Button variant="primary" size="lg" iconRight={<ArrowRight size={16} />}>My dashboard</Button></Link>
          )}
          <Link to="/courses"><Button variant="outline" size="lg">Browse more</Button></Link>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 border-t border-line pt-6 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
          <CheckCircle2 size={12} className="text-verdigris" />
          {status === 'checking' ? <Spinner size={12} /> : null}
          Lumen Academy · test-mode checkout
        </div>
      </div>
    </div>
  );
}
