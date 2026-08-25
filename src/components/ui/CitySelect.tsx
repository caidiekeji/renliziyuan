'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

interface CityOption {
  id: string;
  name: string;
  province?: string | null;
}

/** 城市下拉（数据来自 /api/cities，按省份分组，值存城市名） */
export function CitySelect({
  value,
  onChange,
  label,
  error,
  placeholder = '选择城市',
}: {
  value?: string;
  onChange: (v: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
}) {
  const [cities, setCities] = useState<CityOption[]>([]);

  useEffect(() => {
    api.get<CityOption[]>('/api/cities').then((r) => r.ok && setCities(r.data));
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, CityOption[]>();
    cities.forEach((c) => {
      const key = c.province || '其他';
      const list = map.get(key) || [];
      list.push(c);
      map.set(key, list);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh'));
  }, [cities]);

  return (
    <div className="w-full">
      {label && <label className="mb-1.5 block text-sm font-medium text-text">{label}</label>}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border bg-white px-3 text-sm text-text h-11 transition-colors duration-200 ${
          error ? 'border-danger' : 'border-border hover:border-text-secondary/40'
        }`}
      >
        <option value="">{placeholder}</option>
        {groups.map(([province, list]) => (
          <optgroup key={province} label={province}>
            {list.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
