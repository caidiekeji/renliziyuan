'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ADMIN_NAV } from '@/lib/admin-nav';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageLoading } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api } from '@/lib/api';

interface RatingForm {
  decay_tier1_months: string;
  decay_tier1_weight: string;
  decay_tier2_months: string;
  decay_tier2_weight: string;
  decay_tier3_weight: string;
  low_rating_threshold: string;
  penalty_factor: string;
  min_reviews_for_real: string;
  fallback_rating: string;
  w_rating: string;
}

const EMPTY_FORM: RatingForm = {
  decay_tier1_months: '',
  decay_tier1_weight: '',
  decay_tier2_months: '',
  decay_tier2_weight: '',
  decay_tier3_weight: '',
  low_rating_threshold: '',
  penalty_factor: '',
  min_reviews_for_real: '',
  fallback_rating: '',
  w_rating: '',
};

function RatingConfigContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const { toast } = useToast();
  const [form, setForm] = useState<RatingForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{
        decay_tier1_months?: number;
        decay_tier1_weight?: number;
        decay_tier2_months?: number;
        decay_tier2_weight?: number;
        decay_tier3_weight?: number;
        low_rating_threshold?: number;
        penalty_factor?: number;
        min_reviews_for_real?: number;
        fallback_rating?: number;
        w_rating?: number;
      }>('/api/admin/rating-config')
      .then((r) => {
        if (r.ok) {
          const d = r.data || {};
          setForm({
            decay_tier1_months: String(d.decay_tier1_months ?? ''),
            decay_tier1_weight: String(d.decay_tier1_weight ?? ''),
            decay_tier2_months: String(d.decay_tier2_months ?? ''),
            decay_tier2_weight: String(d.decay_tier2_weight ?? ''),
            decay_tier3_weight: String(d.decay_tier3_weight ?? ''),
            low_rating_threshold: String(d.low_rating_threshold ?? ''),
            penalty_factor: String(d.penalty_factor ?? ''),
            min_reviews_for_real: String(d.min_reviews_for_real ?? ''),
            fallback_rating: String(d.fallback_rating ?? ''),
            w_rating: String(d.w_rating ?? ''),
          });
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (guarding) return <PageLoading />;
  if (loading) return <PageLoading />;

  const set = <K extends keyof RatingForm>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const num = (v: string) => Number(v);
    const body = {
      decay_tier1_months: num(form.decay_tier1_months),
      decay_tier1_weight: num(form.decay_tier1_weight),
      decay_tier2_months: num(form.decay_tier2_months),
      decay_tier2_weight: num(form.decay_tier2_weight),
      decay_tier3_weight: num(form.decay_tier3_weight),
      low_rating_threshold: num(form.low_rating_threshold),
      penalty_factor: num(form.penalty_factor),
      min_reviews_for_real: num(form.min_reviews_for_real),
      fallback_rating: num(form.fallback_rating),
      w_rating: num(form.w_rating),
    };
    setSaving(true);
    const res = await api.put('/api/admin/rating-config', body);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', '评价算法配置已保存，立即生效');
  };

  const numInput = (label: string, key: keyof RatingForm, min: number, max: number, step = '0.1', hint?: string) => (
    <div className="grid grid-cols-[1fr_auto] items-end gap-3 sm:grid-cols-[1fr_160px]">
      <Input label={label} type="number" step={step} min={min} max={max} value={form[key]} onChange={(e) => set(key, e.target.value)} />
      {hint ? <p className="pb-2 text-xs text-text-secondary">{hint}</p> : <span />}
    </div>
  );

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="评价算法">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text">评价算法</h1>
        <Button onClick={save} loading={saving}>
          保存配置
        </Button>
      </div>

      <div className="mb-4 rounded-lg border border-primary-soft bg-primary-soft/50 px-4 py-3 text-sm text-text-secondary">
        控制企业评分的计算方式：时间衰减加权、低评分降权、评价数不足保护，以及推荐打分中的评分权重。修改保存后，重算任务与推荐即时采用新参数。
      </div>

      <div className="space-y-4">
        <Card title="时间衰减权重">
          <div className="space-y-4">
            {numInput('第一档时间范围(月) decay_tier1_months', 'decay_tier1_months', 1, 120, '1', '近 N 个月内的评价')}
            {numInput('第一档权重 decay_tier1_weight', 'decay_tier1_weight', 0, 10, '0.1', '近期评价的加权系数')}
            {numInput('第二档时间范围(月) decay_tier2_months', 'decay_tier2_months', 1, 120, '1', 'N 个月以内的评价')}
            {numInput('第二档权重 decay_tier2_weight', 'decay_tier2_weight', 0, 10, '0.1', '中期评价的加权系数')}
            {numInput('第三档权重 decay_tier3_weight', 'decay_tier3_weight', 0, 10, '0.1', '超出第二档时间的评价')}
          </div>
        </Card>

        <Card title="低评分降权">
          <div className="space-y-4">
            {numInput('降权评分阈值 low_rating_threshold', 'low_rating_threshold', 1, 5, '0.1', '低于此评分触发降权')}
            {numInput('降权系数 penalty_factor', 'penalty_factor', 0, 1, '0.1', '0-1，越小靠后越明显；1 表示不降权')}
            <p className="text-xs text-text-secondary">
              生效范围：免费套餐企业的低评分职位在职位搜索中自动沉底；推荐打分中评分部分按降权系数衰减。
            </p>
          </div>
        </Card>

        <Card title="评价数不足保护">
          <div className="space-y-4">
            {numInput('最少评价数 min_reviews_for_real', 'min_reviews_for_real', 1, 100, '1', '达到该数量才使用真实加权评分')}
            {numInput('默认评分 fallback_rating', 'fallback_rating', 1, 5, '0.1', '评价数不足时与默认评分的混合基准')}
          </div>
        </Card>

        <Card title="推荐评分权重">
          <div className="space-y-4">
            {numInput('评分权重 w_rating', 'w_rating', 0, 1, '0.01', '推荐打分中企业评分的权重')}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}

export default function AdminRatingConfigPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <RatingConfigContent />
    </Suspense>
  );
}
