import { useEffect, useState, type FormEvent } from 'react';
import { Moon, Save, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { errorMessage, useAppConfigQuery, useMeQuery, useUpdateProfileMutation } from '../../api';
import { Avatar, Badge, Button, Field, Input, Textarea } from '../../components/ui';
import { useAppSelector } from '../../hooks';
import { useTheme } from '../../lib/theme';
import { fullDate } from '../../lib/format';
import { useToast } from '../../components/Toast';
import type { UserDTO } from '@lumen/shared';

export default function Settings() {
  const { user } = useAppSelector((state) => state.auth);
  const { data: me } = useMeQuery();
  const { data: config } = useAppConfigQuery();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const { theme, toggle } = useTheme();
  const toast = useToast();

  const profile: UserDTO | undefined = me ?? (user as UserDTO | undefined);

  const [form, setForm] = useState({ name: '', headline: '', bio: '', avatarUrl: '' });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? '',
        headline: profile.headline ?? '',
        bio: profile.bio ?? '',
        avatarUrl: profile.avatarUrl ?? '',
      });
    }
  }, [profile?.id, profile?.name, profile?.headline, profile?.bio, profile?.avatarUrl]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await updateProfile({
        name: form.name,
        headline: form.headline,
        bio: form.bio,
        avatarUrl: form.avatarUrl || '',
      }).unwrap();
      toast.success('Profile saved');
    } catch (error) {
      toast.error('Could not save profile', errorMessage(error));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <div>
        <p className="label-caps mb-2">Account</p>
        <h1 className="text-[clamp(1.8rem,3.4vw,2.5rem)] leading-none text-ink">Settings.</h1>
        <p className="mt-3 text-[13px] text-muted">Manage how you appear across courses, live rooms and certificates.</p>
      </div>

      {/* profile */}
      <form onSubmit={(event) => void save(event)} className="card space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-4 border-b border-line pb-5">
          <Avatar name={form.name || 'L'} src={form.avatarUrl || undefined} size={56} />
          <div>
            <p className="text-[15px] text-ink">{profile?.name}</p>
            <p className="mt-0.5 text-[12px] text-muted">{profile?.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge tone="neutral">{profile?.role}</Badge>
              {profile?.status && <Badge tone={profile.status === 'active' ? 'verdigris' : 'danger'}>{profile.status}</Badge>}
            </div>
          </div>
        </div>

        <Field label="Full name" htmlFor="set-name" required>
          <Input id="set-name" required value={form.name} onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))} />
        </Field>
        <Field label="Headline" htmlFor="set-headline" hint="Shown under your name on courses and in live rooms">
          <Input
            id="set-headline"
            value={form.headline}
            maxLength={120}
            placeholder="Staff engineer · distributed systems"
            onChange={(event) => setForm((f) => ({ ...f, headline: event.target.value }))}
          />
        </Field>
        <Field label="Bio" htmlFor="set-bio" hint="A short note for course pages and instructor profiles">
          <Textarea
            id="set-bio"
            value={form.bio}
            maxLength={2000}
            placeholder="What you work on and what you care about…"
            onChange={(event) => setForm((f) => ({ ...f, bio: event.target.value }))}
          />
        </Field>
        <Field label="Avatar URL" htmlFor="set-avatar" hint="Optional — leave blank to use initials">
          <Input
            id="set-avatar"
            value={form.avatarUrl}
            placeholder="https://…"
            onChange={(event) => setForm((f) => ({ ...f, avatarUrl: event.target.value }))}
          />
        </Field>

        <div className="flex justify-end border-t border-line pt-4">
          <Button type="submit" variant="primary" icon={<Save size={14} />} loading={isLoading}>Save changes</Button>
        </div>
      </form>

      {/* appearance */}
      <section className="card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="label-caps mb-1">Appearance</p>
            <h2 className="text-[17px] text-ink">Theme</h2>
          </div>
          <Badge tone="neutral">{theme}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'dark' as const, label: 'Ink', icon: Moon, desc: 'Dark canvas, ember accents' },
            { id: 'light' as const, label: 'Paper', icon: Sun, desc: 'Warm paper, dark type' },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => { if (theme !== option.id) toggle(); }}
              className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                theme === option.id ? 'border-ember/50 bg-ember/8' : 'border-line hover:border-line-strong'
              }`}
            >
              <option.icon size={18} className={theme === option.id ? 'text-ember' : 'text-muted'} />
              <div>
                <p className="text-[12.5px] text-ink">{option.label}</p>
                <p className="text-[10.5px] text-faint">{option.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* account details + platform config */}
      <section className="card p-5 sm:p-6">
        <p className="label-caps mb-4">Account details</p>
        <dl className="grid gap-x-6 gap-y-3 text-[12.5px] sm:grid-cols-2">
          {[
            ['Email', profile?.email ?? '—'],
            ['Role', profile?.role ?? '—'],
            ['Member since', fullDate(profile?.createdAt)],
            ['Courses joined', String((me as unknown as { enrollmentCount?: number })?.enrollmentCount ?? '—')],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 border-b border-line pb-2">
              <dt className="text-muted">{label}</dt>
              <dd className="font-mono text-[11px] text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        {config && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="label-caps mb-3 flex items-center gap-1.5"><ShieldCheck size={12} /> Platform configuration</p>
            <div className="flex flex-wrap gap-2">
              {[
                ['Payments', config.payments],
                ['Live', config.live],
                ['Media', config.media],
                ['Queue', config.queue],
                ['Fee', `${config.platformFeePct}%`],
              ].map(([label, value]) => (
                <span key={label} className="rounded-lg border border-line bg-raised px-2.5 py-1.5 font-mono text-[10px] text-muted">
                  {label}: <span className="text-ink">{value}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <p className="flex items-center justify-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint">
        <UserRound size={11} /> Lumen Academy · demo build
      </p>
    </div>
  );
}
