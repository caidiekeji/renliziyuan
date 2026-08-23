'use client';

import { useEffect, useState } from 'react';
import { PublicHeader, PublicFooter } from '@/components/layout/PublicLayout';
import { api } from '@/lib/api';
import { PageLoading } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

export interface PolicyData {
  key: string;
  title: string;
  version: number;
  content: string;
  published_at?: string | null;
}

/** 条款展示页：按 policyKey 拉取最新已发布版本（register-agreement / terms / privacy） */
export function PolicyPage({ policyKey }: { policyKey: string }) {
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<PolicyData>(`/api/policies/${policyKey}`).then((r) => {
      if (cancelled) return;
      if (r.ok) setPolicy(r.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [policyKey]);

  if (loading) return <PageLoading />;

  if (!policy) {
    return (
      <div className="min-h-screen bg-bg">
        <PublicHeader />
        <div className="mx-auto max-w-3xl py-24 text-center text-text-secondary">该条款不存在或尚未发布</div>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <PublicHeader />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="card p-5 sm:p-8">
          <div className="mb-5 border-b border-border pb-4">
            <h1 className="text-xl font-bold text-text sm:text-2xl">{policy.title}</h1>
            <p className="mt-2 text-xs text-text-secondary">
              版本 V{policy.version} · 发布于 {formatDate(policy.published_at)}
            </p>
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{policy.content}</div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
