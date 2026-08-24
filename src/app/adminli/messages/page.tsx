'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { formatDateTime, timeAgo } from '@/lib/utils';
import { ADMIN_NAV } from '@/lib/admin-nav';

interface ChatMessage {
  id: string;
  conversation_id?: string;
  sender_id: string;
  content: string;
  is_deleted?: boolean;
  deleted_by?: string | null;
  created_at: string;
  sender?: { id: string; name: string } | null;
}

interface ConversationItem {
  id: string;
  job_id?: string | null;
  candidate_id: string;
  company_id: string;
  last_message_at: string;
  created_at: string;
  candidate: { id: string; name: string };
  company: { id: string; name: string };
  job?: { id: string; title: string } | null;
  /** 最近一条消息（后端 take 1，降序） */
  messages?: ChatMessage[];
}

function MessagesContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;

  const keyword = sp.get('keyword') || '';
  const [kwInput, setKwInput] = useState(keyword);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // 会话消息弹窗
  const [detail, setDetail] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // 单条消息删除
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<ConversationItem[]>('/api/admin/chat' + qs({ keyword, page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setConversations(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [keyword, page]);

  if (guarding) return <PageLoading />;

  const applyFilter = () => {
    const params = new URLSearchParams(sp.toString());
    if (kwInput) params.set('keyword', kwInput);
    else params.delete('keyword');
    params.delete('page');
    router.replace(`/adminli/messages${params.toString() ? `?${params}` : ''}`);
  };

  const openDetail = async (c: ConversationItem) => {
    setDetail(c);
    setMessages([]);
    setDetailLoading(true);
    const r = await api.get<ChatMessage[]>(`/api/admin/chat/${c.id}/messages`);
    if (r.ok) setMessages(r.data);
    setDetailLoading(false);
  };

  const removeMessage = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const res = await api.del(`/api/admin/chat/messages/${deleteTarget.id}`);
    setDeleteLoading(false);
    if (!res.ok) {
      toast('error', res.error?.message || '删除失败');
      setDeleteTarget(null);
      return;
    }
    toast('success', '消息已删除');
    setDeleteTarget(null);
    // 重新拉取当前会话消息
    if (detail) {
      const r = await api.get<ChatMessage[]>(`/api/admin/chat/${detail.id}/messages`);
      if (r.ok) setMessages(r.data);
    }
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="聊天管理">
      <h1 className="mb-5 text-xl font-semibold text-text">聊天管理（{total}）</h1>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-56">
            <Input
              label="搜索"
              placeholder="求职者 / 企业名称"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilter}>搜索</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setKwInput('');
                router.replace('/adminli/messages');
              }}
            >
              重置
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <PageLoading />
        ) : conversations.length === 0 ? (
          <Empty title="暂无会话" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle text-xs text-text-secondary">
                  <th className="px-3 py-3 font-medium">求职者</th>
                  <th className="px-3 py-3 font-medium">企业</th>
                  <th className="px-3 py-3 font-medium">职位</th>
                  <th className="px-3 py-3 font-medium">最后消息</th>
                  <th className="px-3 py-3 font-medium">最后时间</th>
                  <th className="px-3 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-bg-subtle/60">
                    <td className="px-3 py-2.5 font-medium text-text">{c.candidate?.name || '-'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{c.company?.name || '-'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{c.job?.title || '-'}</td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 text-text-secondary">{c.messages?.[0]?.content || '-'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{timeAgo(c.last_message_at)}</td>
                    <td className="px-3 py-2.5">
                      <Button variant="secondary" size="sm" onClick={() => openDetail(c)}>
                        查看消息
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-2 pb-2">
          <Pagination page={page} pageSize={pageSize} total={total} />
        </div>
      </Card>

      {/* 会话消息弹窗 */}
      <Modal
        open={!!detail}
        title={`会话消息 - ${detail?.candidate?.name || ''} ↔ ${detail?.company?.name || ''}`}
        onClose={() => setDetail(null)}
        width="max-w-2xl"
      >
        {detail?.job && <p className="mb-3 text-xs text-text-secondary">职位：{detail.job.title}</p>}
        {detailLoading ? (
          <PageLoading />
        ) : messages.length === 0 ? (
          <Empty title="暂无消息" />
        ) : (
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
            {messages.map((m) => {
              const deleted = !!m.is_deleted;
              return (
                <div key={m.id} className="rounded-lg border border-border bg-bg-subtle/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-text-secondary">
                      <span className="font-medium text-text">{m.sender?.name || '未知'}</span>
                      <span className="ml-2">{formatDateTime(m.created_at)}</span>
                    </p>
                    {!deleted && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(m)}>
                        删除
                      </Button>
                    )}
                  </div>
                  {deleted ? (
                    <p className="mt-1 text-sm italic text-text-secondary">（该消息已被管理员删除）</p>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text">{m.content}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* 删除单条消息确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除消息"
        message="确定删除该条消息吗？删除后双方将不可见（软删除）。"
        confirmText="删除"
        onConfirm={removeMessage}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </DashboardShell>
  );
}

export default function AdminMessagesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <MessagesContent />
    </Suspense>
  );
}
