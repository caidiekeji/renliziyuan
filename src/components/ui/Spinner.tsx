export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-primary border-t-transparent ${className || 'h-5 w-5'}`}
    />
  );
}

export function PageLoading({ text = '加载中…' }: { text?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-text-secondary">
      <Spinner className="h-6 w-6" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
