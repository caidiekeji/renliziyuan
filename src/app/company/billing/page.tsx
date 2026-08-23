'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CompanyShell } from '@/components/company/CompanyShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { useMyCompanies, type Plan, type SubscriptionInfo, type PaymentItem, CHANNEL_LABEL } from '@/lib/company';
import { SUB_STATUS_LABEL, PAYMENT_STATUS_LABEL, formatDate, formatDateTime } from '@/lib/utils';

const CHANNELS = ['ALIPAY', 'WECHAT', 'STRIPE'];

function BillingContent() {
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();
  const { current, loading: memberLoading } = useMyCompanies();

  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [channel, setChannel] = useState('STRIPE');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const companyId = current?.company.id;
  const isOwner = current?.role === 'OWNER';

  useEffect(() => {
    if (memberLoading) return;
    if (!current) {
      router.replace('/company/switch');
      return;
    }
  }, [memberLoading, current, router]);

  const load = useCallback(() => {
    if (!companyId) return;
    setDataLoading(true);
    Promise.all([
      api.get<Plan[]>('/api/plans'),
      api.get<SubscriptionInfo>('/api/subscriptions'),
      api.get<PaymentItem[]>('/api/payments' + qs({ page, pageSize })),
    ]).then(([p, s, pay]) => {
      if (p.ok) setPlans(p.data);
      if (s.ok) setSubInfo(s.data);
      if (pay.ok) {
        setPayments(pay.data);
        setPaymentTotal(Number(pay.meta?.total) || 0);
      }
      setDataLoading(false);
    });
  }, [companyId, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (guarding) return <PageLoading />;
  if (memberLoading || !current) return <PageLoading />;

  const currentPlanId = subInfo?.subscription?.plan?.id;
  const plan = subInfo?.subscription?.plan;
  const jobLimit = plan?.job_limit ?? 3;

  const buy = async (planId: string) => {
    if (!isOwner) return;
    setBuyingId(planId);
    const res = await api.post<{ order_no: string | null; pay_url: string | null; amount: number | string }>('/api/payments', {
      plan_id: planId,
      channel,
    });
    setBuyingId(null);
    if (!res.ok) {
      toast('error', res.error?.message || '下单失败');
      return;
    }
    const { order_no, pay_url } = res.data;
    if (!order_no || !pay_url) {
      toast('success', '套餐已开通');
      load();
      return;
    }
    // 模拟支付：新窗口打开支付页，完成后轮询订单状态
    window.open(pay_url, '_blank');
    toast('info', '已打开支付窗口，请完成支付');
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      const r = await api.get<PaymentItem[]>('/api/payments' + qs({ page: 1, pageSize: 1 }));
      const latest = r.ok ? r.data[0] : null;
      if (latest && latest.order_no === order_no && latest.status === 'PAID') {
        clearInterval(timer);
        toast('success', '支付成功，套餐已生效');
        load();
      } else if (tries >= 15) {
        clearInterval(timer);
        toast('info', '支付结果待确认，可刷新页面查看');
        load();
      }
    }, 2000);
  };

  return (
    <CompanyShell>
      <h1 className="mb-4 text-lg font-bold text-text">会员与账单</h1>

      {/* 当前订阅 */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-text-secondary">当前订阅</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-lg font-bold text-text">{plan?.name || '免费版'}</p>
              {subInfo?.subscription && (
                <Badge tone={subInfo.subscription.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {SUB_STATUS_LABEL[subInfo.subscription.status] || subInfo.subscription.status}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              职位名额 {subInfo?.open_job_count ?? 0} / {jobLimit === 999999 ? '不限' : jobLimit}
              {subInfo?.subscription ? ` · 到期 ${formatDate(subInfo.subscription.end_at)}` : ' · 免费版最多 3 个在招职位'}
            </p>
          </div>
          {!isOwner && (
            <p className="text-xs text-text-secondary">仅企业「所有者」可购买套餐</p>
          )}
        </div>
      </Card>

      {/* 套餐列表 */}
      <h2 className="mb-3 mt-6 text-base font-bold text-text">选购套餐</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dataLoading ? (
          <PageLoading />
        ) : (
          plans.map((pl) => {
            const isCurrent = pl.id === currentPlanId;
            const price = Number(pl.price_monthly ?? 0);
            return (
              <Card key={pl.id} className={`flex flex-col p-5 ${isCurrent ? 'ring-1 ring-primary' : ''}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-text">{pl.name}</h3>
                  {isCurrent && <Badge tone="primary">当前套餐</Badge>}
                </div>
                <p className="mt-2 text-2xl font-bold text-text">
                  {price > 0 ? `¥${price.toFixed(2)}` : '免费'}
                  {price > 0 && <span className="text-sm font-normal text-text-secondary"> / {pl.duration_days} 天</span>}
                </p>
                <ul className="mt-3 space-y-1 text-sm text-text-secondary">
                  <li>职位名额：{pl.job_limit === 999999 ? '不限' : `${pl.job_limit} 个`}</li>
                  <li>职位置顶：{pl.can_feature ? '支持' : '不支持'}</li>
                  <li>查看联系方式：{pl.can_view_contacts ? '支持' : '不支持'}</li>
                </ul>
                <div className="mt-4 flex-1" />
                <Button
                  onClick={() => buy(pl.id)}
                  loading={buyingId === pl.id}
                  disabled={isCurrent || !isOwner}
                  variant={isCurrent ? 'ghost' : 'primary'}
                >
                  {isCurrent ? '已生效' : price > 0 ? '立即购买' : '免费开通'}
                </Button>
              </Card>
            );
          })
        )}
      </div>

      {/* 支付渠道 */}
      <Card className="mt-5 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-56">
            <Select label="支付渠道" value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABEL[c] || c}
                </option>
              ))}
            </Select>
          </div>
          <p className="pb-2 text-xs text-text-secondary">开发环境下仅「模拟支付」渠道可完成支付</p>
        </div>
      </Card>

      {/* 支付流水 */}
      <h2 className="mb-3 mt-6 text-base font-bold text-text">支付记录</h2>
      {dataLoading ? (
        <PageLoading />
      ) : payments.length === 0 ? (
        <Empty title="暂无支付记录" />
      ) : (
        <div className="flex flex-col gap-2">
          {payments.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-text">{p.plan?.name || p.plan_id}</span>
                    <Badge tone={p.status === 'PAID' ? 'success' : p.status === 'PENDING' ? 'warning' : 'neutral'}>
                      {PAYMENT_STATUS_LABEL[p.status] || p.status}
                    </Badge>
                    <Badge tone="default">{CHANNEL_LABEL[p.channel] || p.channel}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    订单号：{p.order_no} · {formatDateTime(p.created_at)}
                    {p.paid_at ? ` · 支付于 ${formatDateTime(p.paid_at)}` : ''}
                  </p>
                </div>
                <p className="font-semibold text-text">¥{Number(p.amount).toFixed(2)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={page} pageSize={pageSize} total={paymentTotal} />
    </CompanyShell>
  );
}

export default function CompanyBillingPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <BillingContent />
    </Suspense>
  );
}
