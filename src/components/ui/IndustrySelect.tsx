'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

export interface IndustryNode {
  id: string;
  name: string;
  code?: string | null;
  parent_id?: string | null;
  children?: IndustryNode[];
}

/** 行业下拉（树形两级，v2.1） */
export function IndustrySelect({
  value,
  onChange,
  placeholder = '选择行业',
  allowClear = true,
}: {
  value?: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const [tree, setTree] = useState<IndustryNode[]>([]);
  const [parent, setParent] = useState<string>('');

  useEffect(() => {
    api.get<IndustryNode[]>('/api/industries').then((r) => r.ok && setTree(r.data));
  }, []);

  const options = useMemo(
    () => tree.flatMap((p) => [p, ...(p.children || [])]),
    [tree]
  );
  const childOptions = parent
    ? (tree.find((p) => p.id === parent)?.children || [])
    : [];

  return (
    <div className="flex w-full gap-2">
      <select
        value={parent}
        onChange={(e) => {
          setParent(e.target.value);
          onChange(null);
        }}
        className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-sm text-text focus:border-text-secondary"
      >
        <option value="">{placeholder}</option>
        {tree.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {parent && (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-sm text-text focus:border-text-secondary"
        >
          <option value="">全部子行业</option>
          {childOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {!parent && value && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-sm text-text focus:border-text-secondary"
        >
          <option value="">{options.find((o) => o.id === value)?.name}</option>
        </select>
      )}
      {allowClear && (value || parent) && (
        <button
          type="button"
          onClick={() => {
            setParent('');
            onChange(null);
          }}
          className="shrink-0 px-2 text-xs text-text-secondary hover:text-danger"
        >
          清除
        </button>
      )}
    </div>
  );
}
