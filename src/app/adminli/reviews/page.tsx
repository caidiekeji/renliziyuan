'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Empty } from '@/components/ui/Empty';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { Rating, StarInput } from '@/components/ui/Rating';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { ADMIN_NAV } from '@/lib/admin-nav';

/** 评价回复审核状态（utils.ts 无对应 Label，本地定义） */
const REPLY_STATUS_LABEL: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
};

const REPLY_STATUS_OPTIONS = [
  { value: '', label: '全部回复状态' },
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已驳回' },
];

interface AdminReview {
  id: string;
  reviewer_id: string;
  reviewee_type: string;
  company_id?: string | null;
  candidate_id?: string | null;
  conversation_id: string;
  rating: number;
  content: string;
  reply?: string | null;
  reply_status: string;
  created_at?: string;
  reviewer: { id: string; name: string };
  company?: { id: string; name: string } | null;
  candidate?: { id: string; name: string } | null;
}

function ReviewsContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;

  const replyStatus = sp.get('reply_status') || '';
  const [replyInput, setReplyInput] = useState(replyStatus);

  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  // 修改评分 / 内容
  const [editTarget, setEditTarget] = useState<AdminReview | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // 删除
  const [deleteTarget, setDeleteTarget] = useState<AdminReview | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<AdminReview[]>('/api/admin/reviews' + qs({ reply_status: replyStatus, page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setReviews(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [replyStatus, page, reloadKey]);

  if (guarding) return <PageLoading />;

  const applyFilter = () => {
    const params = new URLSearchParams(sp.toString());
    if (replyInput) params.set('reply_status', replyInput);
    else params.delete('reply_status');
    params.delete('page');
    router.replace(`/adminli/reviews${params.toString() ? `?${params}` : ''}`);
  };

  const replyAction = async (r: AdminReview, action: 'approveReply' | 'rejectReply') => {
    const res = await api.put(`/api/admin/reviews/${r.id}`, { action });
    if (!res.ok) {
      toast('error', res.error?.message || '操作失败');
      return;
    }
    toast('success', action === 'approveReply' ? '回复已审核通过' : '回复已驳回');
    reload();
  };

  const openEdit = (r: AdminReview) => {
    setEditTarget(r);
    setEditRating(r.rating);
    setEditContent(r.content);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (editRating < 1) {
      toast('error', '请选择评分');
      return;
    }
    if (!editContent.trim()) {
      toast('error', '内容不能为空');
      return;
    }
    setEditSaving(true);
    const res = await api.put(`/api/admin/reviews/${editTarget.id}`, { rating: editRating, content: editContent });
    setEditSaving(false);
    if (!res.ok) {
      toast('error', res.error?.message || '保存失败');
      return;
    }
    toast('success', '评价已更新');
    setEditTarget(null);
    reload();
  };

  const removeReview = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const res = await api.del(`/api/admin/reviews/${deleteTarget.id}`);
    setDeleteLoading(false);
    if (!res.ok) {
      toast('error', res.error?.message || '删除失败');
      setDeleteTarget(null);
      return;
    }
    toast('success', '评价已删除');
    setDeleteTarget(null);
    reload();
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="评价管理">
      <h1 className="mb-4 text-lg font-bold text-text">评价管理（{total}）</h1>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-44">
            <Select label="回复状态" options={REPLY_STATUS_OPTIONS} value={replyInput} onChange={(e) => setReplyInput(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilter}>筛选</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setReplyInput('');
                router.replace('/adminli/reviews');
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
        ) : reviews.length === 0 ? (
          <Empty title="暂无评价" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-secondary">
                  <th className="px-3 py-2 font-medium">评价人</th>
                  <th className="px-3 py-2 font-medium">对象</th>
                  <th className="px-3 py-2 font-medium">评分</th>
                  <th className="px-3 py-2 font-medium">内容</th>
                  <th className="px-3 py-2 font-medium">回复</th>
                  <th className="px-3 py-2 font-medium">回复状态</th>
                  <th className="px-3 py-2 font-medium">时间</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-bg-subtle/60">
                    <td className="px-3 py-2.5 font-medium text-text">{r.reviewer?.name || '-'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">
                      {r.company?.name || r.candidate?.name || '-'}
                      <Badge tone="neutral" className="ml-1">
                        {r.reviewee_type === 'COMPANY' ? '企业' : '求职者'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Rating value={r.rating} size={14} />
                    </td>
                    <td className="max-w-[200px] px-3 py-2.5">
                      <p className="truncate text-text-secondary" title={r.content}>
                        {r.content}
                      </p>
                    </td>
                    <td className="max-w-[160px] px-3 py-2.5">
                      {r.reply ? (
                        <p className="truncate text-text-secondary" title={r.reply}>
                          {r.reply}
                        </p>
                      ) : (
                        <span className="text-text-secondary/50">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={r.reply_status === 'APPROVED' ? 'success' : r.reply_status === 'REJECTED' ? 'danger' : 'warning'}>
                        {REPLY_STATUS_LABEL[r.reply_status] || r.reply_status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{formatDateTime(r.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {r.reply && r.reply_status !== 'APPROVED' && (
                          <Button variant="secondary" size="sm" onClick={() => replyAction(r, 'approveReply')}>
                            通过回复
                          </Button>
                        )}
                        {r.reply && r.reply_status !== 'REJECTED' && (
                          <Button variant="ghost" size="sm" onClick={() => replyAction(r, 'rejectReply')}>
                            驳回回复
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                          修改
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(r)}>
                          删除
                        </Button>
                      </div>
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

      {/* 修改评分 / 内容 */}
      <Modal
        open={!!editTarget}
        title="修改评价"
        onClose={() => setEditTarget(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditTarget(null)} disabled={editSaving}>
              取消
            </Button>
            <Button onClick={saveEdit} loading={editSaving}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">评分</label>
            <StarInput value={editRating} onChange={setEditRating} />
          </div>
          <Textarea
            label="内容"
            rows={4}
            placeholder="评价内容"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
          />
        </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除评价"
        message="确定删除该条评价吗？删除后不可恢复，且会重新计算企业评分。"
        confirmText="删除"
        onConfirm={removeReview}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </DashboardShell>
  );
}

export default function AdminReviewsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ReviewsContent />
    </Suspense>
  );
}
