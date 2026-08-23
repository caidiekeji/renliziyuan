'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { PageLoading } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api } from '@/lib/api';
import { ADMIN_NAV } from '@/lib/admin-nav';

interface Plan {
  id: string;
  name: string;
  price_monthly?: number | string | null;
  price_yearly?: number | string | null;
  job_limit: number;
  can_feature: boolean;
  can_view_contacts: boolean;
  duration_days: number;
  active: boolean;
  created_at?: string;
}

interface PlanFormBody {
  name: string;
  price_monthly?: number;
  price_yearly?: number;
  job_limit: number;
  can_feature: boolean;
  can_view_contacts: boolean;
  duration_days: number;
  active: boolean;
}

/** 套餐新增/编辑表单（字段对齐 planSchema） */
function PlanForm({
  initial,
  saving,
  onCancel,
  onSubmit,
}: {
  initial: Plan | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (body: PlanFormBody) => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    price_monthly: initial?.price_monthly != null ? String(Number(initial.price_monthly)) : '',
    price_yearly: initial?.price_yearly != null ? String(Number(initial.price_yearly)) : '',
    job_limit: initial?.job_limit != null ? String(initial.job_limit) : '3',
    duration_days: initial?.duration_days != null ? String(initial.duration_days) : '30',
    can_feature: initial?.can_feature ?? false,
    can_view_contacts: initial?.can_view_contacts ?? false,
    active: initial?.active ?? true,
  });

  const submit = () => {
    onSubmit({
      name: form.name.trim(),
      price_monthly: form.price_monthly ? Number(form.price_monthly) : undefined,
      price_yearly: form.price_yearly ? Number(form.price_yearly) : undefined,
      job_limit: Number(form.job_limit) || 0,
      can_feature: form.can_feature,
      can_view_contacts: form.can_view_contacts,
      duration_days: Number(form.duration_days) || 1,
      active: form.active,
    });
  };

  const checkCls = 'flex cursor-pointer items-center gap-2 text-sm text-text';

  return (
    <>
      <div className="space-y-3">
        <Input label="套餐名称" placeholder="如 标准版" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="月付价格（元）"
            type="number"
            placeholder="0 表示免费"
            value={form.price_monthly}
            onChange={(e) => setForm({ ...form, price_monthly: e.target.value })}
          />
          <Input
            label="年付价格（元）"
            type="number"
            placeholder="可选"
            value={form.price_yearly}
            onChange={(e) => setForm({ ...form, price_yearly: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="职位名额"
            type="number"
            min={0}
            value={form.job_limit}
            onChange={(e) => setForm({ ...form, job_limit: e.target.value })}
          />
          <Input
            label="时长（天）"
            type="number"
            min={1}
            value={form.duration_days}
            onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className={checkCls}>
            <input
              type="checkbox"
              checked={form.can_feature}
              onChange={(e) => setForm({ ...form, can_feature: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            支持职位置顶
          </label>
          <label className={checkCls}>
            <input
              type="checkbox"
              checked={form.can_view_contacts}
              onChange={(e) => setForm({ ...form, can_view_contacts: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            支持查看联系方式
          </label>
          <label className={checkCls}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            上架中（可购买）
          </label>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          取消
        </Button>
        <Button onClick={submit} loading={saving}>
          保存
        </Button>
      </div>
    </>
  );
}

function BillingContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const { toast } = useToast();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  // 新增 / 编辑
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  // 删除
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<Plan[]>('/api/admin/plans').then((r) => {
      if (r.ok) setPlans(r.data);
      setLoading(false);
    });
  }, [reloadKey]);

  if (guarding) return <PageLoading />;

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (p: Plan) => {
    setEditTarget(p);
    setFormOpen(true);
  };

  const submit = async (body: PlanFormBody) => {
    if (!body.name.trim()) {
      toast('error', '请填写套餐名称');
      return;
    }
    setSaving(true);
    const res = editTarget
      ? await api.put(`/api/admin/plans/${editTarget.id}`, body)
      : await api.post('/api/admin/plans', body);
    setSaving(false);
    if (!res.ok) {
      toast('error', res.error?.message || (editTarget ? '更新失败' : '创建失败'));
      return;
    }
    toast('success', editTarget ? '套餐已更新' : '套餐已创建');
    setFormOpen(false);
    reload();
  };

  const removePlan = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const res = await api.del(`/api/admin/plans/${deleteTarget.id}`);
    setDeleteLoading(false);
    if (!res.ok) {
      toast('error', res.error?.message || '删除失败');
      setDeleteTarget(null);
      return;
    }
    // 有订阅时后端仅停用（active=false），据此提示
    toast('success', (res.data as { note?: string } | undefined)?.note || '套餐已删除');
    setDeleteTarget(null);
    reload();
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="会员计费">
      <h1 className="mb-4 text-lg font-bold text-text">会员计费</h1>

      {/* 套餐管理 */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-text">套餐管理</h2>
        <Button size="sm" onClick={openCreate}>
          新增套餐
        </Button>
      </div>

      <Card>
        {loading ? (
          <PageLoading />
        ) : plans.length === 0 ? (
          <Empty title="暂无套餐" description="点击右上角「新增套餐」创建第一个套餐" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-secondary">
                  <th className="px-3 py-2 font-medium">套餐名</th>
                  <th className="px-3 py-2 font-medium">月付</th>
                  <th className="px-3 py-2 font-medium">年付</th>
                  <th className="px-3 py-2 font-medium">职位上限</th>
                  <th className="px-3 py-2 font-medium">置顶</th>
                  <th className="px-3 py-2 font-medium">看联系方式</th>
                  <th className="px-3 py-2 font-medium">时长(天)</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-bg-subtle/60">
                    <td className="px-3 py-2.5 font-medium text-text">{p.name}</td>
                    <td className="px-3 py-2.5 text-text-secondary">
                      {p.price_monthly != null ? `¥${Number(p.price_monthly).toFixed(2)}` : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">
                      {p.price_yearly != null ? `¥${Number(p.price_yearly).toFixed(2)}` : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{p.job_limit === 999999 ? '不限' : p.job_limit}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{p.can_feature ? '支持' : '-'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{p.can_view_contacts ? '支持' : '-'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{p.duration_days}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={p.active ? 'success' : 'neutral'}>{p.active ? '上架' : '停用'}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                          编辑
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(p)}>
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
      </Card>

      {/* TODO: 订阅管理 —— /api/admin/subscriptions 列表接口不存在（仅有 /api/admin/subscriptions/[id]/cancel 取消接口），按任务要求跳过该块 */}
      {/* TODO: 支付流水 —— /api/admin/payments GET 列表接口不存在（仅有 /api/admin/payments/[id]/refund 退款接口），按任务要求跳过该块 */}

      {/* 新增 / 编辑套餐 */}
      <Modal open={formOpen} title={editTarget ? `编辑套餐 - ${editTarget.name}` : '新增套餐'} onClose={() => setFormOpen(false)} width="max-w-lg">
        <PlanForm initial={editTarget} saving={saving} onCancel={() => setFormOpen(false)} onSubmit={submit} />
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除套餐"
        message={`确定删除套餐「${deleteTarget?.name || ''}」吗？若已有订阅，后端会自动转为停用而非删除。`}
        confirmText="删除"
        onConfirm={removePlan}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </DashboardShell>
  );
}

export default function AdminBillingPage() {
  return <BillingContent />;
}
