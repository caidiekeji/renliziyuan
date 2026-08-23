'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange?: (page: number) => void;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const go = (p: number) => {
    const n = Math.min(totalPages, Math.max(1, p));
    if (onChange) return onChange(n);
    const params = new URLSearchParams(sp.toString());
    if (n <= 1) params.delete('page');
    else params.set('page', String(n));
    router.push(`?${params.toString()}`);
  };

  useEffect(() => {
    // 若当前页超出范围，回退到最后一页
    if (totalPages > 0 && page > totalPages) go(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages, page]);

  if (totalPages <= 1) return null;
  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i);
  }
  const withDots: (number | '...')[] = [];
  pages.forEach((p, idx) => {
    if (idx > 0 && p - pages[idx - 1] > 1) withDots.push('...');
    withDots.push(p);
  });

  return (
    <div className="mt-6 flex items-center justify-center gap-1">
      <button
        className="h-8 rounded-md px-2 text-sm text-text-secondary hover:bg-bg-subtle disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        上一页
      </button>
      {withDots.map((p, i) =>
        p === '...' ? (
          <span key={`d${i}`} className="px-1 text-text-secondary">
            …
          </span>
        ) : (
          <button
            key={p}
            className={`h-8 min-w-8 rounded-md px-2 text-sm ${
              p === page ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-subtle'
            }`}
            onClick={() => go(p)}
          >
            {p}
          </button>
        )
      )}
      <button
        className="h-8 rounded-md px-2 text-sm text-text-secondary hover:bg-bg-subtle disabled:opacity-40"
        disabled={page >= totalPages}
        onClick={() => go(page + 1)}
      >
        下一页
      </button>
    </div>
  );
}
