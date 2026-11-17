import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { cn } from '../lib/format';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (input: { tone?: ToastTone; title: string; description?: string }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ tone = 'info', title, description }: { tone?: ToastTone; title: string; description?: string }) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-3), { id, tone, title, description }]);
      const timer = window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4200);
      timers.current.push(timer);
    },
    [dismiss],
  );

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ tone: 'success', title, description }),
      error: (title, description) => toast({ tone: 'error', title, description }),
      info: (title, description) => toast({ tone: 'info', title, description }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(340px,calc(100vw-2.5rem))] flex-col gap-2">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface/95 p-3 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.75)] backdrop-blur animate-rise',
              item.tone === 'success' && 'border-verdigris/40',
              item.tone === 'error' && 'border-danger/45',
              item.tone === 'info' && 'border-line-strong',
            )}
          >
            <span
              className={cn(
                'mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                item.tone === 'success' && 'bg-verdigris/15 text-verdigris',
                item.tone === 'error' && 'bg-danger/15 text-danger',
                item.tone === 'info' && 'bg-ember/15 text-ember',
              )}
            >
              {item.tone === 'success' ? <Check size={13} /> : item.tone === 'error' ? <AlertTriangle size={13} /> : <Info size={13} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium leading-snug text-ink">{item.title}</p>
              {item.description && <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{item.description}</p>}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss"
              className="text-faint transition-colors hover:text-ink"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
