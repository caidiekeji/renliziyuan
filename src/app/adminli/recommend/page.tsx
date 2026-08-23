'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ADMIN_NAV } from '@/lib/admin-nav';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageLoading } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api } from '@/lib/api';

interface RecForm {
  w_skill: string;
  w_type: string;
  w_city_located: string;
  w_city_expected: string;
  located_city_enabled: boolean;
  w_behavior: string;
  w_b_view: string;
  w_b_favorite: string;
  w_b_chat: string;
  w_hot: string;
  freshness_halflife_days: string;
}

const EMPTY_FORM: RecForm = {
  w_skill: '',
  w_type: '',
  w_city_located: '',
  w_city_expected: '',
  located_city_enabled: true,
  w_behavior: '',
  w_b_view: '',
  w_b_favorite: '',
  w_b_chat: '',
  w_hot: '',
  freshness_halflife_days: '',
};

function RecommendContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const { toast } = useToast();
  const [form, setForm] = useState<RecForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{
        w_skill?: number;
        w_type?: number;
        w_city_located?: number;
        w_city_expected?: number;
        located_city_enabled?: boolean;
        w_behavior?: number;
        w_b_view?: number;
        w_b_favorite?: number;
        w_b_chat?: number;
        w_hot?: number;
        freshness_halflife_days?: number;
      }>('/api/admin/recommendation-config')
      .then((r) => {
        if (r.ok) {
          const d = r.data || {};
          setForm({
            w_skill: String(d.w_skill ?? ''),
            w_type: String(d.w_type ?? ''),
            w_city_located: String(d.w_city_located ?? ''),
            w_city_expected: String(d.w_city_expected ?? ''),
            located_city_enabled: d.located_city_enabled !== false,
            w_behavior: String(d.w_behavior ?? ''),
            w_b_view: String(d.w_b_view ?? ''),
            w_b_favorite: String(d.w_b_favorite ?? ''),
            w_b_chat: String(d.w_b_chat ?? ''),
            w_hot: String(d.w_hot ?? ''),
            freshness_halflife_days: String(d.freshness_halflife_days ?? ''),
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

  const set = <K extends keyof RecForm>(k: K, v: RecForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const num = (v: string) => Number(v);
    const body = {
      w_skill: num(form.w_skill),
      w_type: num(form.w_type),
      w_city_located: num(form.w_city_located),
      w_city_expected: num(form.w_city_expected),
      located_city_enabled: form.located_city_enabled,
      w_behavior: num(form.w_behavior),
      w_b_view: num(form.w_b_view),
      w_b_favorite: num(form.w_b_favorite),
      w_b_chat: num(form.w_b_chat),
      w_hot: num(form.w_hot),
      freshness_halflife_days: num(form.freshness_halflife_days),
    };
    setSaving(true);
    const res = await api.put('/api/admin/recommendation-config', body);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', '推荐配置已保存，立即生效');
  };

  const weightInput = (label: string, key: keyof RecForm, hint?: string) => (
    <div className="grid grid-cols-[1fr_auto] items-end gap-3 sm:grid-cols-[1fr_140px]">
      <Input label={label} type="number" step="0.1" min={0} max={100} value={form[key] as string} onChange={(e) => set(key, e.target.value)} />
      {hint ? <p className="pb-2 text-xs text-text-secondary">{hint}</p> : <span />}
    </div>
  );

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="推荐运营">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">推荐运营</h1>
        <Button onClick={save} loading={saving}>
          保存配置
        </Button>
      </div>

      <div className="mb-4 rounded-lg border border-primary-soft bg-primary-soft/50 px-4 py-3 text-sm text-text-secondary">
        权重越高越重要，行为权重按 浏览/收藏/沟通 加权。修改保存后下次推荐即生效。
      </div>

      <div className="space-y-4">
        <Card title="内容匹配权重">
          <div className="space-y-4">
            {weightInput('技能匹配权重 w_skill', 'w_skill')}
            {weightInput('职位类型匹配权重 w_type', 'w_type')}
            {weightInput('定位同城权重 w_city_located', 'w_city_located')}
            {weightInput('期望同城权重 w_city_expected', 'w_city_expected')}
            <Switch
              label="启用实时定位城市信号"
              hint="关闭后不再使用用户实时定位城市参与推荐"
              checked={form.located_city_enabled}
              onChange={(v) => set('located_city_enabled', v)}
            />
          </div>
        </Card>

        <Card title="行为权重">
          <div className="space-y-4">
            {weightInput('行为总权重 w_behavior', 'w_behavior')}
            {weightInput('浏览 w_b_view', 'w_b_view')}
            {weightInput('收藏 w_b_favorite', 'w_b_favorite')}
            {weightInput('沟通 w_b_chat', 'w_b_chat')}
          </div>
        </Card>

        <Card title="热度与新鲜度">
          <div className="space-y-4">
            {weightInput('热度权重 w_hot', 'w_hot', '与 浏览/收藏/沟通 按 1/3/5 加权')}
            <div className="grid grid-cols-[1fr_auto] items-end gap-3 sm:grid-cols-[1fr_140px]">
              <Input label="新鲜度半衰期(天) freshness_halflife_days" type="number" min={1} max={365} value={form.freshness_halflife_days} onChange={(e) => set('freshness_halflife_days', e.target.value)} />
              <span />
            </div>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}

export default function AdminRecommendPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <RecommendContent />
    </Suspense>
  );
}
