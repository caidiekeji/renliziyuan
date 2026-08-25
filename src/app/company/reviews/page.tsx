'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CompanyShell, CompanyGuard } from '@/components/company/CompanyShell';
import { useMyCompanies } from '@/lib/company';
import { api } from '@/lib/api';
import { PageLoading } from '@/components/ui/Spinner';
import { Rating } from '@/components/ui/Rating';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Empty } from '@/components/ui/Empty';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';

interface ReviewItem {
  id: string;
  rating: number;
  content: string;
  reply?: string | null;
  reply_status: string;
  created_at: string;
  reviewer: { id: string; name: string; avatar?: string | null; title?: string | null };
}

interface ReviewData {
  items: ReviewItem[];
  avg_rating: number | string | null;
  review_count: number;
}

const REPLY_STATUS_LABEL: Record<string, string> = {
  APPROVED: '已通过',
  PENDING: '待审核',
  REJECTED: '已驳回',
};

function ReviewsContent() {
  const sp = useSearchParams();
  const { toast } = useToast();
  const { current } = useMyCompanies();
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const pageSize = 10;
  const [data, setData] = useState<ReviewData | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState<ReviewItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!current) return;
    setLoading(true);
    api
      .get<ReviewData>(`/api/companies/${current.company.id}/reviews?manage=1&page=${page}&pageSize=${pageSize}`)
      .then((r) => {
        if (r.ok) {
          setData(r.data);
          setTotal(r.meta?.total || 0);
        }
        setLoading(false);
      });
  }, [current, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (!current) return <PageLoading />;

  const submitReply = async () => {
    if (!replyTarget || !replyText.trim()) return;
    setSaving(true);
    const res = await api.post(`/api/reviews/${replyTarget.id}/reply`, { reply: replyText.trim() });
    setSaving(false);
    if (res.ok) {
      toast('success', '回复已提交');
      setReplyTarget(null);
      setReplyText('');
      load();
    } else {
      toast('error', res.error?.message || '回复失败');
    }
  };

  return (
    <CompanyShell>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">收到的评价</h1>
          <p className="mt-0.5 text-xs text-text-secondary">
            平均评分 {Number(data?.avg_rating || 0).toFixed(1)} · 共 {data?.review_count ?? 0} 条
          </p>
        </div>
      </div>

      {loading ? (
        <PageLoading />
      ) : !data?.items.length ? (
        <Empty title="暂无评价" description="当求职者完成会话后会在这里看到评价" />
      ) : (
        <div className="space-y-3">
          {data.items.map((r) => (
            <div key={r.id} className="card p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-text">
                    {r.reviewer.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text">{r.reviewer.name}</p>
                    {r.reviewer.title && <p className="text-xs text-text-secondary">{r.reviewer.title}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Rating value={r.rating} size={14} />
                  {r.reply_status !== 'APPROVED' && <Badge tone="warning">{REPLY_STATUS_LABEL[r.reply_status] || r.reply_status}</Badge>}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">{r.content}</p>
              {r.reply && (
                <div className="mt-3 rounded-lg border-l-2 border-primary bg-primary-soft/30 px-3 py-2.5">
                  <p className="text-xs font-medium text-primary">企业回复</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{r.reply}</p>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-text-secondary/70">{formatDateTime(r.created_at)}</span>
                <Button size="sm" variant="secondary" onClick={() => { setReplyTarget(r); setReplyText(r.reply || ''); }}>
                  {r.reply ? '修改回复' : '回复'}
                </Button>
              </div>
            </div>
          ))}
          <Pagination page={page} pageSize={pageSize} total={total} />
        </div>
      )}

      <Modal open={!!replyTarget} title={replyTarget ? `回复「${replyTarget.reviewer.name}」的评价` : ''} onClose={() => setReplyTarget(null)}>
        <Textarea
          rows={5}
          maxLength={500}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="感谢评价，回复将展示在评价下方…"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setReplyTarget(null)}>
            取消
          </Button>
          <Button onClick={submitReply} loading={saving} disabled={!replyText.trim()}>
            提交回复
          </Button>
        </div>
      </Modal>
    </CompanyShell>
  );
}

export default function CompanyReviewsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CompanyGuard>
        <ReviewsContent />
      </CompanyGuard>
    </Suspense>
  );
}
