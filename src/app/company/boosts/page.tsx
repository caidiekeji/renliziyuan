'use client';

import { Suspense, useEffect, useState } from 'react';
import { CompanyShell } from '@/components/company/CompanyShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { PageLoading } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { CitySelect } from '@/components/ui/CitySelect';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { useMyCompanies, type JobItem } from '@/lib/company';
import { JOB_TYPE_LABEL, formatDate } from '@/lib/utils';

interface BoostItem {
  id: string;
  job_id: string;
  city: string;
  job_type?: string | null;
  bid: number | string;
  status: string; // PENDING | ACTIVE | PAUSED | EXPIRED | REJECTED
  start_date: string;
  end_date: string;
  paused_at?: string | null;
  total_cost: number | string;
  created_at: string;
  job: { id: string; title: string; is_hourly: boolean };
}

interface BoostStats {
  views: number;
  cost: number;
  bid: number;
  rank: number | null;
  start_date: string;
  end_date: string;
  status: string;
  trend: { date: string; amount: number }[];
}

const BOOST_STATUS_LABEL: Record<string, string> = {
  PENDING: '待审核',
  ACTIVE: '生效中',
  PAUSED: '已暂停',
  EXPIRED: '已过期',
  REJECTED: '已驳回',
};

const JOB_TYPE_OPTIONS = [
  { value: '', label: '不限职位类型' },
  { value: 'FULL_TIME', label: '全职' },
  { value: 'PART_TIME', label: '兼职' },
  { value: 'INTERN', label: '实习' },
  { value: 'CONTRACT', label: '合同工' },
  { value: 'HOURLY', label: '小时工' },
];

function CompanyBoostsContent() {
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  const { toast } = useToast();
  const { current } = useMyCompanies();

  const [boosts, setBoosts] = useState<BoostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const [openJobs, setOpenJobs] = useState<JobItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ job_id: '', city: '', job_type: '', bid: '', start_date: '', end_date: '' });
  const [creating, setCreating] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BoostItem | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [statsJob, setStatsJob] = useState<BoostItem | null>(null);
  const [stats, setStats] = useState<BoostStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const companyId = current?.company.id;

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    api.get<BoostItem[]>('/api/company/boosts').then((r) => {
      if (r.ok) setBoosts(r.data);
      setLoading(false);
    });
  }, [companyId, reloadKey]);

  useEffect(() => {
    if (!companyId) return;
    api.get<JobItem[]>(`/api/companies/${companyId}/jobs` + qs({ page: 1, pageSize: 50 })).then((r) => {
      if (r.ok) setOpenJobs(r.data.filter((j) => j.status === 'OPEN' && !j.is_hourly));
    });
  }, [companyId, reloadKey]);

  if (guarding) return <PageLoading />;

  const openCreate = () => {
    const today = new Date();
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    setCreateForm({ job_id: '', city: '', job_type: '', bid: '', start_date: fmt(today), end_date: fmt(end) });
    setCreateOpen(true);
  };

  const create = async () => {
    if (!createForm.job_id) return toast('error', '请选择职位');
    if (!createForm.city) return toast('error', '请选择目标城市');
    if (!createForm.bid || Number(createForm.bid) <= 0) return toast('error', '请填写出价（元/天）');
    if (!createForm.start_date || !createForm.end_date) return toast('error', '请选择投放日期');
    if (createForm.end_date < createForm.start_date) return toast('error', '结束日期不能早于开始日期');

    setCreating(true);
    const res = await api.post('/api/company/boosts', {
      job_id: createForm.job_id,
      city: createForm.city,
      job_type: createForm.job_type || undefined,
      bid: Number(createForm.bid),
      start_date: createForm.start_date,
      end_date: createForm.end_date,
    });
    setCreating(false);
    if (!res.ok) return toast('error', res.error?.message || '创建失败');
    toast('success', '置顶已提交，等待平台审核');
    setCreateOpen(false);
    reload();
  };

  const act = async (id: string, fn: () => Promise<{ ok: boolean; error?: { message?: string } }>, okMsg: string) => {
    setBusyId(id);
    const res = await fn();
    setBusyId(null);
    if (!res.ok) return toast('error', res.error?.message || '操作失败');
    toast('success', okMsg);
    reload();
  };

  const viewStats = async (b: BoostItem) => {
    setStatsJob(b);
    setStats(null);
    setStatsLoading(true);
    const res = await api.get<BoostStats>(`/api/company/boosts/${b.id}/stats`);
    setStatsLoading(false);
    if (res.ok) setStats(res.data);
  };

  const doCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    const res = await api.del(`/api/company/boosts/${cancelTarget.id}`);
    setCancelling(false);
    setCancelTarget(null);
    if (!res.ok) return toast('error', res.error?.message || '取消失败');
    toast('success', '已取消置顶');
    reload();
  };

  return (
    <CompanyShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">竞价置顶</h1>
        <Button size="sm" onClick={openCreate}>
          创建置顶
        </Button>
      </div>
      <p className="mb-4 text-xs text-text-secondary">
        按天计费、出价高的排前面；同一城市下仅展示出价最高的 3 个置顶。创建后需平台审核通过才开始生效。
      </p>

      {loading ? (
        <PageLoading />
      ) : boosts.length === 0 ? (
        <Card>
          <Empty title="暂无置顶记录" description="创建置顶需企业钱包有余额，且套餐支持竞价置顶功能" />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {boosts.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-text">{b.job.title}</span>
                    <Badge tone={b.status === 'ACTIVE' ? 'success' : b.status === 'PENDING' ? 'warning' : 'neutral'}>
                      {BOOST_STATUS_LABEL[b.status] || b.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {b.city} · 出价 ¥{Number(b.bid).toFixed(2)}/天
                    {b.job_type ? ` · ${JOB_TYPE_LABEL[b.job_type] || b.job_type}` : ' · 不限类型'}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    投放 {formatDate(b.start_date)} ~ {formatDate(b.end_date)} · 已花费 ¥{Number(b.total_cost).toFixed(2)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => viewStats(b)}>
                    数据看板
                  </Button>
                  {b.status === 'ACTIVE' && (
                    <Button size="sm" variant="ghost" loading={busyId === b.id} onClick={() => act(b.id, () => api.post(`/api/company/boosts/${b.id}/pause`), '已暂停置顶')}>
                      暂停
                    </Button>
                  )}
                  {b.status === 'PAUSED' && (
                    <Button size="sm" variant="secondary" loading={busyId === b.id} onClick={() => act(b.id, () => api.post(`/api/company/boosts/${b.id}/resume`), '已恢复置顶')}>
                      恢复
                    </Button>
                  )}
                  {['PENDING', 'PAUSED'].includes(b.status) && (
                    <Button size="sm" variant="ghost" onClick={() => setCancelTarget(b)}>
                      取消
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 创建置顶 */}
      <Modal open={createOpen} title="创建竞价置顶" onClose={() => setCreateOpen(false)} width="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">关联职位</label>
            <Select value={createForm.job_id} onChange={(e) => setCreateForm((f) => ({ ...f, job_id: e.target.value }))}>
              <option value="">选择在招职位</option>
              {openJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CitySelect label="目标城市" value={createForm.city} onChange={(v) => setCreateForm((f) => ({ ...f, city: v }))} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">职位类型</label>
              <Select value={createForm.job_type} onChange={(e) => setCreateForm((f) => ({ ...f, job_type: e.target.value }))} options={JOB_TYPE_OPTIONS} />
            </div>
          </div>
          <Input label="出价（元/天）" type="number" min={0} step="0.01" placeholder="如 5" value={createForm.bid} onChange={(e) => setCreateForm((f) => ({ ...f, bid: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="开始日期" type="date" value={createForm.start_date} onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))} />
            <Input label="结束日期" type="date" value={createForm.end_date} onChange={(e) => setCreateForm((f) => ({ ...f, end_date: e.target.value }))} />
          </div>
          <p className="text-xs text-text-secondary">创建时将从企业钱包冻结「出价 × 投放天数」的金额，审核不通过自动退回。</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={create} loading={creating}>
              提交审核
            </Button>
          </div>
        </div>
      </Modal>

      {/* 取消确认 */}
      <ConfirmDialog
        open={!!cancelTarget}
        title="取消置顶"
        message={`确认取消「${cancelTarget?.job.title}」的置顶？将释放剩余冻结金额。`}
        onConfirm={doCancel}
        onCancel={() => setCancelTarget(null)}
        confirmText="确认取消"
        loading={cancelling}
      />

      {/* 数据看板 */}
      <Modal open={!!statsJob} title={`数据看板：${statsJob?.job.title || ''}`} onClose={() => setStatsJob(null)} width="max-w-xl">
        {statsLoading ? (
          <PageLoading />
        ) : !stats ? (
          <Empty title="暂无数据" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-bg-subtle p-3 text-center">
                <p className="text-xs text-text-secondary">当前排名</p>
                <p className="mt-1 text-lg font-bold text-text">{stats.rank ? `第 ${stats.rank} 名` : '未上榜'}</p>
              </div>
              <div className="rounded-lg bg-bg-subtle p-3 text-center">
                <p className="text-xs text-text-secondary">展示量</p>
                <p className="mt-1 text-lg font-bold text-text">{stats.views}</p>
              </div>
              <div className="rounded-lg bg-bg-subtle p-3 text-center">
                <p className="text-xs text-text-secondary">出价/天</p>
                <p className="mt-1 text-lg font-bold text-text">¥{Number(stats.bid).toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-bg-subtle p-3 text-center">
                <p className="text-xs text-text-secondary">累计花费</p>
                <p className="mt-1 text-lg font-bold text-text">¥{Number(stats.cost).toFixed(2)}</p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-text">每日花费（近 14 天）</p>
              {stats.trend.length === 0 ? (
                <p className="text-xs text-text-secondary">暂无扣费记录</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {stats.trend.map((t) => (
                    <div key={t.date} className="flex items-center gap-2 text-xs text-text-secondary">
                      <span className="w-24 shrink-0">{t.date}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded bg-bg-subtle">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, (t.amount / Math.max(...stats.trend.map((x) => x.amount), 0.01)) * 100)}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right">¥{Number(t.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-text-secondary">
              投放 {formatDate(stats.start_date)} ~ {formatDate(stats.end_date)} · 状态：{BOOST_STATUS_LABEL[stats.status] || stats.status}
            </p>
          </div>
        )}
      </Modal>
    </CompanyShell>
  );
}

export default function CompanyBoostsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CompanyBoostsContent />
    </Suspense>
  );
}
