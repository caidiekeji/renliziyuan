'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ADMIN_NAV } from '@/lib/admin-nav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

interface AdminWallet {
  company_id: string;
  balance: number | string;
  frozen: number | string;
  total_recharge: number | string;
  total_consume: number | string;
  updated_at: string;
  company: { id: string; name: string; verify_status: string };
}

interface WalletTxn {
  id: string;
  type: string;
  amount: number | string;
  balance_after: number | string;
  order_no?: string | null;
  description?: string | null;
  created_at: string;
}

const TXN_TYPE_LABEL: Record<string, string> = {
  RECHARGE: '充值',
  CONSUME: '消费',
  FREEZE: '冻结',
  UNFREEZE: '解冻',
  REFUND: '退款',
  ADJUST: '调账',
};

const TXN_TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'RECHARGE', label: '充值' },
  { value: 'CONSUME', label: '消费' },
  { value: 'FREEZE', label: '冻结' },
  { value: 'UNFREEZE', label: '解冻' },
  { value: 'REFUND', label: '退款' },
  { value: 'ADJUST', label: '调账' },
];

function AdminWalletsContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;
  const keyword = sp.get('keyword') || '';
  const [kwInput, setKwInput] = useState(keyword);

  const [items, setItems] = useState<AdminWallet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const [txnTarget, setTxnTarget] = useState<AdminWallet | null>(null);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [txnTotal, setTxnTotal] = useState(0);
  const [txnPage, setTxnPage] = useState(1);
  const [txnType, setTxnType] = useState('');
  const [txnLoading, setTxnLoading] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState<AdminWallet | null>(null);
  const [adjustForm, setAdjustForm] = useState({ delta: '', reason: '' });
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<AdminWallet[]>('/api/admin/wallets' + qs({ keyword: keyword || undefined, page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setItems(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [keyword, page, reloadKey]);

  if (guarding) return <PageLoading />;

  const applyFilter = () => {
    const params = new URLSearchParams(sp.toString());
    if (kwInput) params.set('keyword', kwInput);
    else params.delete('keyword');
    params.delete('page');
    router.replace(`/adminli/wallets${params.toString() ? `?${params}` : ''}`);
  };

  const viewTxns = async (w: AdminWallet, pageNum = 1, type = '') => {
    setTxnTarget(w);
    setTxnPage(pageNum);
    setTxnType(type);
    setTxnLoading(true);
    const res = await api.get<WalletTxn[]>(`/api/admin/wallets/${w.company.id}/transactions` + qs({ type: type || undefined, page: pageNum, pageSize: 10 }));
    setTxnLoading(false);
    if (res.ok) {
      setTxns(res.data);
      setTxnTotal(Number(res.meta?.total) || 0);
    }
  };

  const openAdjust = (w: AdminWallet) => {
    setAdjustTarget(w);
    setAdjustForm({ delta: '', reason: '' });
  };

  const submitAdjust = async () => {
    if (!adjustTarget) return;
    const delta = Number(adjustForm.delta);
    if (!Number.isFinite(delta) || delta === 0) return toast('error', '调整金额不能为 0');
    if (!adjustForm.reason.trim()) return toast('error', '请填写调账原因');
    setAdjusting(true);
    const res = await api.post(`/api/admin/wallets/${adjustTarget.company.id}/adjust`, {
      delta,
      reason: adjustForm.reason.trim(),
    });
    setAdjusting(false);
    if (!res.ok) return toast('error', res.error?.message || '调账失败');
    setAdjustTarget(null);
    toast('success', delta > 0 ? '已入账' : '已扣减');
    reload();
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="企业余额">
      <h1 className="mb-5 text-xl font-semibold text-text">企业余额</h1>

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="企业名称" placeholder="输入企业名称搜索" value={kwInput} onChange={(e) => setKwInput(e.target.value)} className="w-56" />
          <div className="flex gap-2">
            <Button onClick={applyFilter}>搜索</Button>
            <Button variant="ghost" onClick={() => { setKwInput(''); router.replace('/adminli/wallets'); }}>重置</Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <PageLoading />
      ) : items.length === 0 ? (
        <Card>
          <Empty title="暂无企业余额账户" />
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle text-xs text-text-secondary">
                  <th className="px-3 py-3 font-medium">企业</th>
                  <th className="px-3 py-3 font-medium">可用余额</th>
                  <th className="px-3 py-3 font-medium">冻结</th>
                  <th className="px-3 py-3 font-medium">累计充值</th>
                  <th className="px-3 py-3 font-medium">累计消费</th>
                  <th className="px-3 py-3 font-medium">更新时间</th>
                  <th className="px-3 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((w) => (
                  <tr key={w.company_id} className="border-b border-border/60 last:border-0 hover:bg-bg-subtle/60">
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-text">{w.company.name}</span>
                      <Badge tone={w.company.verify_status === 'VERIFIED' ? 'success' : 'neutral'} className="ml-2">
                        {w.company.verify_status === 'VERIFIED' ? '已认证' : w.company.verify_status === 'PENDING' ? '待审核' : '未认证'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-primary">¥{Number(w.balance).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-text-secondary">¥{Number(w.frozen).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-text-secondary">¥{Number(w.total_recharge).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-text-secondary">¥{Number(w.total_consume).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary">{formatDateTime(w.updated_at)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => viewTxns(w)}>
                          流水
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openAdjust(w)}>
                          调账
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-2 pb-2">
            <Pagination page={page} pageSize={pageSize} total={total} />
          </div>
        </Card>
      )}

      {/* 交易流水 */}
      <Modal open={!!txnTarget} title={`交易流水：${txnTarget?.company.name || ''}`} onClose={() => setTxnTarget(null)} width="max-w-2xl">
        <div className="mb-3 flex items-center gap-2">
          <div className="w-40">
            <Select value={txnType} onChange={(e) => viewTxns(txnTarget!, 1, e.target.value)} options={TXN_TYPE_OPTIONS} />
          </div>
          <span className="text-xs text-text-secondary">共 {txnTotal} 条</span>
        </div>
        {txnLoading ? (
          <PageLoading />
        ) : txns.length === 0 ? (
          <Empty title="暂无交易记录" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle text-xs text-text-secondary">
                  <th className="px-3 py-2.5 font-medium">类型</th>
                  <th className="px-3 py-2.5 font-medium">金额</th>
                  <th className="px-3 py-2.5 font-medium">余额</th>
                  <th className="px-3 py-2.5 font-medium">描述</th>
                  <th className="px-3 py-2.5 font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2.5">
                      <Badge tone={t.type === 'RECHARGE' ? 'success' : t.type === 'CONSUME' ? 'danger' : 'default'}>
                        {TXN_TYPE_LABEL[t.type] || t.type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-text">
                      {t.type === 'CONSUME' ? '-' : '+'}¥{Number(t.amount).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">¥{Number(t.balance_after).toFixed(2)}</td>
                    <td className="max-w-48 truncate px-3 py-2.5 text-text-secondary">{t.description || (t.order_no ? `订单 ${t.order_no}` : '—')}</td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary">{formatDateTime(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={txnPage} pageSize={10} total={txnTotal} onChange={(p) => viewTxns(txnTarget!, p, txnType)} />
      </Modal>

      {/* 调账 */}
      <Modal
        open={!!adjustTarget}
        title={`手动调账：${adjustTarget?.company.name || ''}`}
        onClose={() => setAdjustTarget(null)}
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdjustTarget(null)} disabled={adjusting}>
              取消
            </Button>
            <Button onClick={submitAdjust} loading={adjusting}>
              确认调账
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="调整金额（正数入账 / 负数扣减）"
            type="number"
            step="0.01"
            placeholder="如 100 或 -50"
            value={adjustForm.delta}
            onChange={(e) => setAdjustForm((f) => ({ ...f, delta: e.target.value }))}
          />
          <Input label="调账原因" placeholder="必填，如：活动补偿 / 异常扣费退还" value={adjustForm.reason} onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))} />
          <p className="text-xs text-text-secondary">调账操作将记录到操作审计，请谨慎操作。</p>
        </div>
      </Modal>
    </DashboardShell>
  );
}

export default function AdminWalletsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminWalletsContent />
    </Suspense>
  );
}
