'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  closing: boolean;
}

const ToastContext = createContext<{ toast: (type: ToastType, message: string) => void }>({
  toast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.map((t) => t.id === id ? { ...t, closing: true } : t));
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 300);
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, type, message, closing: false }]);
    setTimeout(() => dismiss(id), 3000);
  }, [dismiss]);

  const icon = (t: ToastType) =>
    t === 'success' ? '✓' : t === 'error' ? '✕' : 'ℹ';

  const color = (t: ToastType) =>
    t === 'success'
      ? 'border-success text-success'
      : t === 'error'
        ? 'border-danger text-danger'
        : 'border-primary text-primary';

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-4 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            role="alert"
            aria-live="polite"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-white px-4 py-3 text-sm shadow-lg ${
              t.closing ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'
            } ${color(t.type)} transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]`}
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold">
              {icon(t.type)}
            </span>
            <span className="flex-1 text-text">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-text-secondary/50 hover:text-text-secondary"
              aria-label="关闭"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
