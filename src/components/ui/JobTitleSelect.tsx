'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';

export interface JobTitleOption {
  id: string;
  name: string;
  code?: string | null;
  category: string;
  sub_category?: string | null;
}

/** 职位名称下拉（分类→职能→职位 三级，支持模糊搜索，v2.1） */
export function JobTitleSelect({
  value,
  onChange,
  placeholder = '选择职位名称',
}: {
  value?: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [titles, setTitles] = useState<JobTitleOption[]>([]);
  const [keyword, setKeyword] = useState('');
  const [cat, setCat] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<JobTitleOption[]>('/api/job-titles').then((r) => r.ok && setTitles(r.data));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const categories = useMemo(() => [...new Set(titles.map((t) => t.category))], [titles]);
  const selected = titles.find((t) => t.id === value);

  const filtered = useMemo(() => {
    let list = titles;
    if (cat) list = list.filter((t) => t.category === cat);
    if (keyword.trim()) list = list.filter((t) => t.name.includes(keyword.trim()));
    return list.slice(0, 50);
  }, [titles, cat, keyword]);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-11 w-full items-center justify-between rounded-lg border border-border bg-white px-3 text-sm text-text transition-colors duration-200 hover:border-text-secondary/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        <span className={selected ? 'text-text' : 'text-text-secondary/60'}>
          {selected ? `${selected.category} · ${selected.name}` : placeholder}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-30 w-full rounded-lg border border-border bg-white p-2 shadow-lg">
          <div className="flex gap-1.5 overflow-x-auto pb-1.5">
            <button
              type="button"
              onClick={() => setCat('')}
              className={`shrink-0 rounded-md px-2 py-1 text-xs ${!cat ? 'bg-primary text-white' : 'bg-bg-subtle text-text-secondary'}`}
            >
              全部
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`shrink-0 rounded-md px-2 py-1 text-xs ${cat === c ? 'bg-primary text-white' : 'bg-bg-subtle text-text-secondary'}`}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索职位名称…"
            className="mb-1.5 h-9 w-full rounded-md border border-border px-2 text-xs transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onChange(t.id);
                  setOpen(false);
                }}
                className={`block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-primary-soft ${
                  value === t.id ? 'bg-primary-soft text-text' : 'text-text'
                }`}
              >
                <span className="font-medium">{t.name}</span>
                <span className="ml-1 text-xs text-text-secondary">
                  {t.category}
                  {t.sub_category ? ` / ${t.sub_category}` : ''}
                </span>
              </button>
            ))}
            {filtered.length === 0 && <p className="py-4 text-center text-xs text-text-secondary">无匹配职位名称</p>}
          </div>
        </div>
      )}
    </div>
  );
}
