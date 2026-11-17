import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, Copy, Search, ShieldAlert, ShieldCheck, Stamp } from 'lucide-react';
import { errorMessage, useVerifyCertificateQuery } from '../api';
import { Badge, Button, EmptyState, Field, Input, Skeleton } from '../components/ui';
import { fullDate } from '../lib/format';

function Result({ serial }: { serial: string }) {
  const { data, isLoading, error } = useVerifyCertificateQuery(serial);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<ShieldAlert size={20} />}
        title="No certificate matches that serial"
        description={errorMessage(error, 'Check the serial and try again. Serials look like LMN-2026-XXXXXX.')}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <div className="overflow-hidden rounded-2xl border border-verdigris/35 bg-surface shadow-[0_30px_80px_-45px_rgba(0,0,0,0.9)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[color-mix(in_oklab,var(--color-verdigris)_10%,transparent)] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-verdigris/40 bg-verdigris/15 text-verdigris">
              <ShieldCheck size={20} />
            </span>
            <div>
              <p className="font-display text-[17px] text-ink">Verified certificate</p>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-verdigris">
                Issuer: {data.issuer} · record is authentic
              </p>
            </div>
          </div>
          <Badge tone="verdigris" dot>Valid</Badge>
        </div>

        <div className="relative overflow-hidden bg-[#F7F3EA] p-7 text-[#14161B] sm:p-10">
          <div className="absolute inset-4 border border-[#14161B]/60" />
          <div className="absolute inset-[19px] border border-[#E2542A]/70" />
          <div className="relative px-3 py-2 text-center sm:px-8">
            <div className="flex items-center justify-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E2542A] font-display text-[16px]">L</span>
              <div className="text-left">
                <p className="font-mono text-[8px] uppercase tracking-[0.22em]">Lumen Academy</p>
                <p className="font-mono text-[6.5px] uppercase tracking-[0.14em] text-[#3E7F70]">Certificate registry</p>
              </div>
            </div>

            <p className="mt-7 font-mono text-[7px] uppercase tracking-[0.24em] text-[#E2542A]">Certificate of completion</p>
            <p className="mt-3 font-display text-[16px] italic text-[#4B4F57]">This certifies that</p>
            <p className="mt-2 font-display text-[clamp(1.6rem,4vw,2.4rem)] leading-none">{data.studentName}</p>
            <div className="mx-auto my-4 h-px w-40 bg-[#14161B]/25" />
            <p className="text-[8px] uppercase tracking-[0.12em] text-[#5D626C]">has successfully completed</p>
            <p className="mt-1.5 font-display text-[17px] leading-tight">{data.courseTitle}</p>

            <div className="mt-8 flex flex-wrap items-end justify-between gap-6 text-left">
              <div>
                <p className="font-display text-[13px] italic">{data.instructorName}</p>
                <div className="mt-1 h-px w-32 bg-[#14161B]" />
                <p className="mt-1 font-mono text-[6px] uppercase tracking-[0.14em] text-[#5D626C]">Course instructor</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[7.5px] text-[#5D626C]">Issued {fullDate(data.issuedAt)}</p>
                <p className="mt-1 font-mono text-[7.5px] font-semibold tracking-[0.06em]">{data.serial}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2 text-[11.5px] text-muted">
            <Stamp size={14} className="text-verdigris" />
            Serial <span className="font-mono text-ink">{data.serial}</span>
          </div>
          <CopyButton value={`${window.location.origin}${data.verifyUrl}`} />
        </div>
      </div>

      <p className="mt-5 text-center text-[12px] leading-relaxed text-muted">
        This record was matched against the Lumen Academy certificate registry. Serials are unique and issued only
        after every lesson and the passing assessment are complete.
      </p>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      icon={<Copy size={13} />}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      {copied ? 'Copied' : 'Copy verification link'}
    </Button>
  );
}

export default function Verify() {
  const { serial } = useParams();
  const [input, setInput] = useState(serial ?? '');
  const [query, setQuery] = useState<string | null>(serial ?? null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setQuery(input.trim().toUpperCase() || null);
  };

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-verdigris/35 bg-verdigris/10 text-verdigris">
          <BadgeCheck size={22} />
        </div>
        <p className="label-caps mt-5">Public registry</p>
        <h1 className="mt-2 text-[clamp(2rem,4vw,2.9rem)] leading-none text-ink">Verify a certificate.</h1>
        <p className="mx-auto mt-3 max-w-lg text-[13.5px] leading-relaxed text-muted">
          Every Lumen certificate carries a unique serial. Enter it below to confirm the record against the issuer —
          no login required.
        </p>
      </div>

      <form onSubmit={submit} className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Certificate serial" className="flex-1" htmlFor="serial">
          <Input
            id="serial"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="LMN-2026-4F8A2C"
            className="font-mono uppercase tracking-[0.06em]"
          />
        </Field>
        <Button type="submit" variant="primary" icon={<Search size={15} />} className="sm:mb-0">
          Verify
        </Button>
      </form>

      {query ? (
        <div className="mt-12">
          <Result serial={query} />
        </div>
      ) : (
        <div className="mx-auto mt-12 max-w-xl">
          <EmptyState
            icon={<ShieldCheck size={18} />}
            title="Try a demo serial"
            description="Seed a demo database and use a certificate serial from your learner dashboard, or finish a course to earn your own."
            action={
              <Link to="/courses">
                <Button variant="secondary" size="sm">Browse courses</Button>
              </Link>
            }
          />
        </div>
      )}
    </div>
  );
}
