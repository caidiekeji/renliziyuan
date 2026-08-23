'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { timeAgo } from '@/lib/utils';
import { Pagination } from '@/components/ui/Pagination';
import { Empty } from '@/components/ui/Empty';
import { PageLoading } from '@/components/ui/Spinner';

export interface ConversationItem {
  id: string;
  job?: { id: string; title: string } | null;
  candidate?: { id: string; name: string; avatar?: string | null } | null;
  company?: { id: string; name: string; logo?: string | null } | null;
  messages?: { id: string; content: string; sender_id: string; created_at: string; read_at?: string | null }[];
}

/** 会话列表（求职者视角显示企业名/企业视角显示求职者名） */
export function ConversationList({
  basePath,
  title,
  viewAs,
}: {
  basePath: string;
  title: string;
  viewAs: 'candidate' | 'company';
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    api
      .get<ConversationItem[]>('/api/conversations' + qs({ page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setItems(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [page]);

  const isUnread = (c: ConversationItem) => {
    const last = c.messages?.[0];
    return !!last && last.sender_id !== user?.id && !last.read_at;
  };

  return (
    <div className="min-h-screen bg-bg-subtle">
      {/* 移动端顶栏（复用 DashboardShell 样式） */}
      <div className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-white px-4 lg:hidden">
        <Link href="/" className="text-xs text-text-secondary">
          返回首页
        </Link>
        <span className="text-sm font-semibold">{title}</span>
        <span className="w-14" />
      </div>

      <div className="mx-auto max-w-3xl px-0 py-4 sm:px-4">
        <div className="hidden px-2 lg:mb-4 lg:block lg:px-0">
          <h1 className="text-xl font-bold text-text">{title}</h1>
        </div>

        {loading ? (
          <PageLoading />
        ) : items.length === 0 ? (
          <Empty title="暂无会话" description="在职位详情页发起沟通后，对话会显示在这里" />
        ) : (
          <div className="space-y-2 px-2 sm:px-0">
            {items.map((c) => {
              const last = c.messages?.[0];
              const unread = isUnread(c);
              const name = viewAs === 'candidate' ? c.company?.name || '企业' : c.candidate?.name || '求职者';
              const avatar = viewAs === 'candidate' ? c.company?.logo : c.candidate?.avatar;
              return (
                <button
                  key={c.id}
                  onClick={() => router.push(`${basePath}/${c.id}`)}
                  className="card card-hover flex w-full items-center gap-3 p-4 text-left"
                >
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-text">
                      {(name || '?').slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`truncate text-sm ${unread ? 'font-bold text-text' : 'font-medium text-text'}`}>{name}</p>
                      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className={`mt-0.5 truncate text-xs ${unread ? 'font-medium text-text' : 'text-text-secondary'}`}>
                      {c.job?.title ? `${c.job.title} · ` : ''}
                      {last ? last.content : '暂无消息'}
                    </p>
                  </div>
                  {last && <span className="shrink-0 text-xs text-text-secondary">{timeAgo(last.created_at)}</span>}
                </button>
              );
            })}
          </div>
        )}
        <div className="px-2 sm:px-0">
          <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}
