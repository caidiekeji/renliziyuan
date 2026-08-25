'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CompanyShell } from '@/components/company/CompanyShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { useMyCompanies } from '@/lib/company';
import { formatDateTime } from '@/lib/utils';

interface WalletInfo {
  company_id: string;
  balance: number | string;
  frozen: number | string;
  total_recharge: number | string;
  total_consume: number | string;
}

interface WalletTxn {
  id: string;
  type: string; // RECHARGE | CONSUME | FREEZE | UNFREEZE | REFUND | ADJUST
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

function CompanyWalletContent() {
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();
  const { current } = useMyCompanies();

  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;
  const type = sp.get('type') || '';
  const [typeInput, setTypeInput] = useState(type);

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState('100');
  const [channels, setChannels] = useState<{ channel: string; label: string }[]>([]);
  const [channel, setChannel] = useState('');
  const [recharging, setRecharging] = useState(false);

  const companyId = current?.company.id;

  // 可用支付渠道：数据库已启用的真实渠道（不含模拟支付）
  useEffect(() => {
    api.get<{ channels: { channel: string; label: string }[] }>('/api/payments/channels').then((r) => {
      if (!r.ok) return;
      const list = r.data.channels || [];
      setChannels(list);
      setChannel((prev) => (list.some((c) => c.channel === prev) ? prev : list[0]?.channel || ''));
    });
  }, []);

  const load = useCallback(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      api.get<WalletInfo>('/api/company/wallet'),
      api.get<WalletTxn[]>('/api/company/wallet/transactions' + qs({ type: type || undefined, page, pageSize })),
    ]).then(([w, t]) => {
      if (w.ok) setWallet(w.data);
      if (t.ok) {
        setTxns(t.data);
        setTotal(Number(t.meta?.total) || 0);
      }
      setLoading(false);
    });
  }, [companyId, type, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (guarding) return <PageLoading />;

  const applyFilter = () => {
    const params = new URLSearchParams(sp.toString());
    if (typeInput) params.set('type', typeInput);
    else params.delete('type');
    params.delete('page');
    router.replace(`/company/wallet${params.toString() ? `?${params}` : ''}`);
  };

  const recharge = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 10 || amt > 10000) return toast('error', '充值金额需在 10~10000 元之间');
    if (channels.length === 0) return toast('error', '暂无可用的支付方式，请先联系管理员配置支付渠道');
    setRecharging(true);
    const res = await api.post<{ order_no: string | null; pay_url: string | null; amount: number }>('/api/company/wallet/recharge', {
      amount: amt,
      channel,
    });
    setRecharging(false);
    if (!res.ok) return toast('error', res.error?.message || '下单失败');
    const { order_no, pay_url } = res.data;
    if (!order_no || !pay_url) return toast('success', '充值已入账');
    window.open(pay_url, '_blank');
    toast('info', '已打开支付窗口，请完成支付');
    // 轮询最新流水确认到账
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      const r = await api.get<WalletTxn[]>('/api/company/wallet/transactions?page=1&pageSize=1');
      const latest = r.ok ? r.data[0] : null;
      if (latest && latest.type === 'RECHARGE' && Number(latest.amount) === amt) {
        clearInterval(timer);
        toast('success', '充值成功，余额已到账');
        load();
      } else if (tries >= 15) {
        clearInterval(timer);
        load();
      }
    }, 2000);
  };

  return (
    <CompanyShell>
      <h1 className="mb-5 text-xl font-semibold text-text">企业钱包</h1>

      {/* 余额概览 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-6">
          <p className="text-sm text-text-secondary">可用余额</p>
          <p className="mt-1 text-2xl font-bold text-primary">¥{Number(wallet?.balance ?? 0).toFixed(2)}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-text-secondary">冻结金额</p>
          <p className="mt-1 text-2xl font-bold text-text">¥{Number(wallet?.frozen ?? 0).toFixed(2)}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-text-secondary">累计充值</p>
          <p className="mt-1 text-2xl font-bold text-text">¥{Number(wallet?.total_recharge ?? 0).toFixed(2)}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-text-secondary">累计消费</p>
          <p className="mt-1 text-2xl font-bold text-text">¥{Number(wallet?.total_consume ?? 0).toFixed(2)}</p>
        </div>
      </div>

      {/* 充值 */}
      <Card className="mt-5 p-5">
        <h2 className="mb-3 text-base font-bold text-text">余额充值</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-48">
            <Input label="充值金额（元）" type="number" min={10} max={10000} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="w-full sm:w-48">
            {channels.length === 0 ? (
              <Input label="支付渠道" value="暂无可用的支付方式" disabled />
            ) : (
              <Select label="支付渠道" value={channel} onChange={(e) => setChannel(e.target.value)}>
                {channels.map((c) => (
                  <option key={c.channel} value={c.channel}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <Button onClick={recharge} loading={recharging} disabled={channels.length === 0}>
            立即充值
          </Button>
        </div>
        {channels.length === 0 && (
          <p className="mt-2 text-xs text-text-secondary">充值金额 10~10000 元；请先由管理员在后台配置支付宝/微信支付渠道。</p>
        )}
      </Card>

      {/* 交易流水 */}
      <div className="mb-3 mt-6 flex items-center gap-2">
        <h2 className="text-base font-bold text-text">交易记录</h2>
        <div className="ml-auto w-44">
          <Select value={typeInput} onChange={(e) => setTypeInput(e.target.value)} options={TXN_TYPE_OPTIONS} />
        </div>
        <Button variant="secondary" size="sm" onClick={applyFilter}>
          筛选
        </Button>
      </div>
      {loading ? (
        <PageLoading />
      ) : txns.length === 0 ? (
        <Card>
          <Empty title="暂无交易记录" />
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-secondary">
                  <th className="px-4 py-3 font-medium">类型</th>
                  <th className="px-4 py-3 font-medium">金额</th>
                  <th className="px-4 py-3 font-medium">余额</th>
                  <th className="px-4 py-3 font-medium">描述</th>
                  <th className="px-4 py-3 font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-b border-border/60 last:border-0 hover:bg-bg-subtle">
                    <td className="px-4 py-3">
                      <Badge tone={t.type === 'RECHARGE' ? 'success' : t.type === 'CONSUME' ? 'danger' : 'default'}>
                        {TXN_TYPE_LABEL[t.type] || t.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-text">
                      {t.type === 'CONSUME' ? '-' : '+'}¥{Number(t.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">¥{Number(t.balance_after).toFixed(2)}</td>
                    <td className="max-w-56 truncate px-4 py-3 text-text-secondary">{t.description || (t.order_no ? `订单 ${t.order_no}` : '—')}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDateTime(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} />
    </CompanyShell>
  );
}

export default function CompanyWalletPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CompanyWalletContent />
    </Suspense>
  );
}
