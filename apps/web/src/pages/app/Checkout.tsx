import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, LockKeyhole, ShieldCheck } from 'lucide-react';
import { errorMessage, useOrderQuery, usePayOrderMutation } from '../../api';
import { CourseCover } from '../../components/CourseCover';
import { Badge, Button, EmptyState, Field, Input, Skeleton } from '../../components/ui';
import { fullDate, money } from '../../lib/format';
import { useToast } from '../../components/Toast';

export default function Checkout() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: order, isLoading } = useOrderQuery(orderId);
  const [pay, { isLoading: paying }] = usePayOrderMutation();
  const [card, setCard] = useState('4242 4242 4242 4242');
  const [name, setName] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await pay({ orderId, card: card.replace(/\s/g, '') }).unwrap();
      navigate(`/checkout/success?course=${encodeURIComponent(result.courseSlug ?? '')}&order=${orderId}`, { replace: true });
    } catch (error) {
      toast.error('Payment failed', errorMessage(error, 'Check your card details'));
    }
  };

  if (isLoading) {
    return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
  }

  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        description="This checkout link may have expired or belongs to another account."
        action={<Link to="/courses"><Button variant="secondary">Back to catalog</Button></Link>}
      />
    );
  }

  if (order.status === 'paid') {
    return (
      <EmptyState
        title="Already paid"
        description="This order has been fulfilled and the course is in your library."
        action={<Link to={`/courses/${order.course?.slug ?? ''}`}><Button variant="primary">Go to course</Button></Link>}
      />
    );
  }

  const course = order.course;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/courses" className="mb-5 inline-block">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />}>Back to catalog</Button>
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-caps mb-2">Checkout</p>
          <h1 className="text-[clamp(1.7rem,3.2vw,2.3rem)] leading-none text-ink">Complete your purchase.</h1>
        </div>
        <Badge tone="ochre" dot>Test mode</Badge>
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_0.9fr]">
        {/* payment form */}
        <form onSubmit={(event) => void submit(event)} className="card space-y-5 p-5">
          <div className="flex items-center gap-2 border-b border-line pb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ember/10 text-ember"><CreditCard size={17} /></span>
            <div>
              <p className="text-[13px] text-ink">Card details</p>
              <p className="text-[11px] text-faint">No real charge — this is a simulated gateway</p>
            </div>
          </div>

          <Field label="Name on card" htmlFor="card-name">
            <Input id="card-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Lovelace" />
          </Field>
          <Field label="Card number" htmlFor="card-number" hint="Test card 4242 4242 4242 4242 succeeds · ending 0002 declines">
            <div className="relative">
              <Input
                id="card-number"
                value={card}
                inputMode="numeric"
                onChange={(event) => setCard(event.target.value)}
                placeholder="4242 4242 4242 4242"
                className="pr-9 font-mono tracking-[0.08em]"
              />
              <LockKeyhole size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint" />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry" htmlFor="card-exp"><Input id="card-exp" placeholder="12 / 30" /></Field>
            <Field label="CVC" htmlFor="card-cvc"><Input id="card-cvc" placeholder="123" inputMode="numeric" /></Field>
          </div>

          <Button type="submit" variant="primary" size="lg" block loading={paying} iconRight={<ShieldCheck size={16} />}>
            Pay {money(order.amount)}
          </Button>
          <p className="text-center font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
            Encrypted in transit · test-mode authorisation only
          </p>
        </form>

        {/* summary */}
        <aside className="space-y-4">
          <div className="card overflow-hidden">
            {course && <CourseCover cover={course.cover} className="aspect-[16/9] rounded-none" />}
            <div className="space-y-3 p-4">
              <div>
                <p className="text-[14px] font-medium leading-snug text-ink">{course?.title ?? 'Course'}</p>
                <p className="mt-0.5 text-[11.5px] text-faint">{course?.instructorName}</p>
              </div>
              <dl className="space-y-2 border-t border-line pt-3 text-[12px]">
                <div className="flex justify-between"><dt className="text-muted">Order</dt><dd className="font-mono text-[10.5px] text-ink">{order.id.slice(-8).toUpperCase()}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Date</dt><dd className="font-mono text-[10.5px] text-ink">{fullDate(order.createdAt)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Provider</dt><dd className="font-mono text-[10.5px] uppercase text-ink">{order.provider}</dd></div>
                <div className="flex justify-between border-t border-line pt-2"><dt className="text-ink">Total</dt><dd className="font-display text-[20px] leading-none text-ink">{money(order.amount)}</dd></div>
              </dl>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-[color-mix(in_oklab,var(--c-surface)_55%,var(--c-canvas))] p-4">
            <p className="label-caps mb-2">What happens next</p>
            <ul className="space-y-2 text-[11.5px] leading-relaxed text-muted">
              <li className="flex gap-2"><span className="text-verdigris">✓</span> Instant access to every lesson and downloadable resources</li>
              <li className="flex gap-2"><span className="text-verdigris">✓</span> Graded quiz and verifiable certificate on completion</li>
              <li className="flex gap-2"><span className="text-verdigris">✓</span> Access to the course's live critique rooms</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
