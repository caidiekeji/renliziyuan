export function Empty({ title = '暂无数据', description, action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-bg-subtle">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-secondary/60">
          <path d="M9 12h6M9 16h4m7 3V8l-4-4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2Z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-text">{title}</p>
      {description && <p className="mt-1 text-xs text-text-secondary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
