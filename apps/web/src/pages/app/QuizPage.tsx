import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  HelpCircle,
  RotateCcw,
  Send,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { errorMessage, useQuizQuery, useStartAttemptMutation, useSubmitAttemptMutation } from '../../api';
import type { AttemptResultDTO } from '@lumen/shared';
import { Badge, Button, EmptyState, ProgressBar, Skeleton, Spinner } from '../../components/ui';
import { duration } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { cn } from '../../lib/format';

type Answers = Record<string, number[]>;

export default function QuizPage() {
  const { quizId = '' } = useParams();
  const toast = useToast();
  const { data: quiz, isLoading } = useQuizQuery(quizId);
  const [startAttempt, { isLoading: starting }] = useStartAttemptMutation();
  const [submitAttempt, { isLoading: submitting }] = useSubmitAttemptMutation();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<(AttemptResultDTO & { earned: number; passingScore: number }) | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const answersRef = useRef<Answers>({});
  const attemptRef = useRef<string | null>(null);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!attemptId || !quiz?.timeLimitSec) {
      setRemaining(null);
      return;
    }
    startedAtRef.current = Date.now();
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const left = Math.max(0, quiz.timeLimitSec - elapsed);
      setRemaining(left);
      if (left === 0 && attemptRef.current) {
        const id = attemptRef.current;
        attemptRef.current = null;
        setAttemptId(null);
        const payload = Object.entries(answersRef.current).map(([questionId, selected]) => ({ questionId, selected }));
        void submitAttempt({ attemptId: id, answers: payload })
          .unwrap()
          .then((response) => {
            setResult(response);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          })
          .catch(() => undefined);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [attemptId, quiz?.timeLimitSec, submitAttempt]);

  const begin = async () => {
    try {
      const result = await startAttempt(quizId).unwrap();
      setAttemptId(result.attemptId);
      attemptRef.current = result.attemptId;
      setAnswers({});
      answersRef.current = {};
      setResult(null);
    } catch (error) {
      toast.error('Could not start quiz', errorMessage(error));
    }
  };

  const submit = async () => {
    if (!attemptId) return;
    const payload = Object.entries(answersRef.current).map(([questionId, selected]) => ({ questionId, selected }));
    try {
      const response = await submitAttempt({ attemptId, answers: payload }).unwrap();
      setResult(response);
      attemptRef.current = null;
      setAttemptId(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast.error('Could not submit answers', errorMessage(error));
    }
  };

  const toggleAnswer = (questionId: string, index: number, multi: boolean) => {
    setAnswers((current) => {
      const existing = current[questionId] ?? [];
      const next = multi
        ? { ...current, [questionId]: existing.includes(index) ? existing.filter((i) => i !== index) : [...existing, index] }
        : { ...current, [questionId]: [index] };
      answersRef.current = next;
      return next;
    });
  };

  if (isLoading) {
    return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div>;
  }

  if (!quiz) {
    return (
      <EmptyState
        icon={<HelpCircle size={20} />}
        title="Quiz not found"
        description="This assessment may have been removed or the link is incorrect."
        action={<Link to="/app"><Button variant="secondary">Back to dashboard</Button></Link>}
      />
    );
  }

  const attemptsLeft = quiz.attemptsAllowed - quiz.attemptsUsed;

  if (result) {
    const pct = result.maxScore ? Math.round((result.score / result.maxScore) * 100) : 0;
    return (
      <div className="mx-auto max-w-3xl animate-rise">
        <div className={cn(
          'overflow-hidden rounded-2xl border bg-surface',
          result.passed ? 'border-verdigris/40' : 'border-danger/40',
        )}>
          <div className={cn(
            'flex flex-wrap items-center gap-4 p-7',
            result.passed ? 'bg-verdigris/8' : 'bg-danger/8',
          )}>
            <span className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full border',
              result.passed ? 'border-verdigris/45 bg-verdigris/15 text-verdigris' : 'border-danger/45 bg-danger/15 text-danger',
            )}>
              {result.passed ? <Trophy size={26} /> : <XCircle size={26} />}
            </span>
            <div className="flex-1">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted">Result</p>
              <h1 className="mt-1 text-[26px] leading-none text-ink">
                {result.passed ? 'Passed' : 'Not quite yet'}
              </h1>
              <p className="mt-2 text-[12.5px] text-muted">
                You scored {result.score} / {result.maxScore} ({pct}%). Passing is {result.passingScore}%.
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-[38px] leading-none text-ink">{pct}%</p>
              <ProgressBar value={pct} tone={result.passed ? 'verdigris' : 'ember'} className="mt-2 w-28" />
            </div>
          </div>

          <div className="divide-y divide-line border-t border-line">
            {quiz.questions.map((question, index) => {
              const detail = result.breakdown.find((item) => item.questionId === question.id);
              return (
                <div key={question.id} className="p-5">
                  <div className="flex items-start gap-3">
                    <span className={cn(
                      'mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      detail?.correct ? 'bg-verdigris/15 text-verdigris' : 'bg-danger/15 text-danger',
                    )}>
                      {detail?.correct ? <Check size={12} /> : <X size={12} />}
                    </span>
                    <div className="flex-1">
                      <p className="text-[13px] leading-snug text-ink">
                        <span className="mr-1.5 font-mono text-[10px] text-faint">{index + 1}.</span>
                        {question.prompt}
                      </p>
                      <p className="mt-1.5 font-mono text-[10px] text-faint">
                        Earned {detail?.earned ?? 0} / {detail?.points ?? question.points} points
                      </p>
                      {detail?.explanation && (
                        <p className="mt-2 rounded-md border border-line bg-raised px-3 py-2 text-[12px] leading-relaxed text-muted">
                          {detail.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[color-mix(in_oklab,var(--c-canvas)_55%,var(--c-surface))] px-5 py-4">
            <Link to="/app">
              <Button variant="ghost" icon={<ArrowLeft size={14} />}>Back to dashboard</Button>
            </Link>
            {attemptsLeft > 0 ? (
              <Button variant="primary" icon={<RotateCcw size={14} />} onClick={() => void begin()} loading={starting}>
                Try again ({attemptsLeft} left)
              </Button>
            ) : (
              <Badge tone="neutral">No attempts remaining</Badge>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link to="/app" className="mb-5 inline-block"><Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />}>Back</Button></Link>
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-7 sm:p-9">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 100% at 85% 0%, rgba(227,179,65,0.12), transparent 60%)' }} />
          <div className="relative">
            <Badge tone="ochre" dot>Assessment</Badge>
            <h1 className="mt-4 text-[30px] leading-none text-ink">{quiz.title}</h1>
            <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-muted">
              Answer every question and reach {quiz.passingScore}% to pass. You have {quiz.attemptsAllowed} attempt{quiz.attemptsAllowed > 1 ? 's' : ''} in total.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                { icon: HelpCircle, label: 'Questions', value: String(quiz.questions.length) },
                { icon: Trophy, label: 'Passing score', value: `${quiz.passingScore}%` },
                { icon: Clock3, label: 'Time limit', value: quiz.timeLimitSec ? duration(quiz.timeLimitSec) : 'Untimed' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl border border-line bg-[color-mix(in_oklab,var(--c-canvas)_55%,var(--c-surface))] p-4">
                  <Icon size={16} className="text-ochre" />
                  <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">{label}</p>
                  <p className="mt-1 font-display text-[20px] text-ink">{value}</p>
                </div>
              ))}
            </div>

            {quiz.bestScore != null && (
              <div className="mt-5 flex items-center gap-2 rounded-lg border border-verdigris/30 bg-verdigris/8 px-3 py-2.5 text-[12px] text-muted">
                <CheckCircle2 size={15} className="text-verdigris" />
                Your best score: <span className="font-mono text-ink">{quiz.bestScore}%</span>
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {attemptsLeft > 0 ? (
                <Button variant="primary" size="lg" iconRight={<Send size={15} />} loading={starting} onClick={() => void begin()}>
                  Start attempt {quiz.attemptsUsed + 1}
                </Button>
              ) : (
                <Badge tone="neutral">No attempts remaining</Badge>
              )}
              <span className="font-mono text-[10px] text-faint">{attemptsLeft} of {quiz.attemptsAllowed} attempts left</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const answered = Object.values(answers).filter((values) => values.length > 0).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-14 z-20 -mx-4 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <Badge tone="ochre" dot>Attempt in progress</Badge>
          <span className="font-mono text-[10px] text-faint">{answered} / {quiz.questions.length} answered</span>
        </div>
        <div className="flex items-center gap-3">
          {remaining !== null && (
            <span className={cn('flex items-center gap-1.5 font-mono text-[12px]', remaining < 30 ? 'text-danger' : 'text-muted')}>
              <Clock3 size={13} /> {duration(remaining)}
            </span>
          )}
          <Button variant="primary" size="sm" loading={submitting} disabled={answered === 0} icon={<Send size={13} />} onClick={() => void submit()}>
            Submit
          </Button>
        </div>
      </div>

      <ProgressBar value={(answered / quiz.questions.length) * 100} className="mb-6" height={4} />

      <div className="space-y-4">
        {quiz.questions.map((question, index) => {
          const multi = question.type === 'multi';
          const selected = answers[question.id] ?? [];
          return (
            <div key={question.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-raised font-mono text-[10px] text-muted">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[13.5px] leading-snug text-ink">{question.prompt}</p>
                  <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
                    {multi ? 'Select all that apply' : 'Select one'} · {question.points} point{question.points > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="space-y-2 pl-9">
                {question.options.map((option, optionIndex) => {
                  const active = selected.includes(optionIndex);
                  return (
                    <button
                      key={optionIndex}
                      onClick={() => toggleAnswer(question.id, optionIndex, multi)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-[12.5px] transition-colors',
                        active ? 'border-ember/50 bg-ember/10 text-ink' : 'border-line text-muted hover:border-line-strong hover:text-ink',
                      )}
                    >
                      <span className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center border',
                        multi ? 'rounded' : 'rounded-full',
                        active ? 'border-ember bg-ember' : 'border-line-strong',
                      )}>
                        {active && <Check size={11} className="text-[#160B06]" />}
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => { setAttemptId(null); setAnswers({}); }}>
          Abandon
        </Button>
        <Button variant="primary" size="lg" loading={submitting} disabled={answered === 0} iconRight={<Send size={15} />} onClick={() => void submit()}>
          Submit answers
        </Button>
      </div>

      {submitting && <div className="mt-4 flex items-center justify-center gap-2 text-[12px] text-muted"><Spinner size={14} /> Grading…</div>}
    </div>
  );
}
