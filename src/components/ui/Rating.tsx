export function Rating({ value, size = 14 }: { value?: number | string | null; size?: number }) {
  const num = Number(value) || 0;
  const v = Math.round(num);
  const has = value != null && value !== '';
  return (
    <span className="inline-flex items-center gap-0.5" title={has ? `${num} 星` : '暂无评分'}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= v ? '#f5a623' : '#e5e8ee'}>
          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export function StarInput({
  value,
  onChange,
  max = 5,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].slice(0, max).map((i) => (
        <button key={i} type="button" onClick={() => onChange(i)} className="p-0.5" aria-label={`${i} 星`}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill={i <= value ? '#f5a623' : '#e5e8ee'} className="transition-transform hover:scale-110">
            <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );
}
