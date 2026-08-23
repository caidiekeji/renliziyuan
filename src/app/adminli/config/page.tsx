'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ADMIN_NAV } from '@/lib/admin-nav';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageLoading } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api } from '@/lib/api';

interface SiteConfig {
  [key: string]: string | number | boolean | null | undefined;
}
interface SeoConfig {
  title?: string;
  description?: string;
  keywords?: string;
  sitemap_enabled?: boolean;
}

/** 数字字段（保存时转 Number） */
const NUM_FIELDS = [
  'page_size',
  'token_ttl_min',
  'refresh_ttl_days',
  'chat_rate_limit_per_min',
  'sms_rate_limit_per_min',
  'upload_max_mb',
  'queue_attempts',
  'queue_backoff_ms',
];

function ConfigContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const { toast } = useToast();
  const [site, setSite] = useState<SiteConfig | null>(null);
  const [seo, setSeo] = useState<SeoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get<{ site?: SiteConfig; seo?: SeoConfig } | SiteConfig>('/api/admin/site-config').then((r) => {
      if (r.ok) {
        const d = (r.data ?? {}) as Record<string, unknown>;
        const hasSite = d.site && typeof d.site === 'object' && !Array.isArray(d.site);
        if (hasSite) {
          setSite(d.site as SiteConfig);
          setSeo((d.seo as SeoConfig) || {});
        } else {
          setSite(d as unknown as SiteConfig);
          setSeo({});
        }
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (guarding) return <PageLoading />;
  if (loading) return <PageLoading />;
  if (!site) return null;

  const setSiteField = (k: string, v: string | number | boolean) => setSite((s) => (s ? { ...s, [k]: v } : s));
  const setSeoField = (k: string, v: string | number | boolean) => setSeo((s) => ({ ...(s || {}), [k]: v }));

  const save = async () => {
    if (!site) return;
    const siteBody: Record<string, string | number | boolean> = {};
    Object.entries(site).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      siteBody[k] = NUM_FIELDS.includes(k) ? Number(v) || 0 : v;
    });
    const seoBody: Record<string, string | number | boolean> = {};
    Object.entries(seo || {}).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      seoBody[k] = v;
    });
    setSaving(true);
    const res = await api.put('/api/admin/site-config', { site: siteBody, seo: seoBody });
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', '全局配置已保存');
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="全局配置">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">全局配置</h1>
        <Button onClick={save} loading={saving}>
          保存配置
        </Button>
      </div>

      <div className="space-y-4">
        {/* 站点 */}
        <Card title="站点">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="站点名称" maxLength={50} value={String(site.site_name ?? '')} onChange={(e) => setSiteField('site_name', e.target.value)} />
            <Input label="默认城市" maxLength={50} placeholder="未定位时的兜底城市" value={String(site.default_city ?? '')} onChange={(e) => setSiteField('default_city', e.target.value)} />
            <Input label="分页大小" type="number" min={1} max={100} value={String(site.page_size ?? '')} onChange={(e) => setSiteField('page_size', e.target.value)} />
            <Input label="ICP 备案号" maxLength={50} value={String(site.icp_no ?? '')} onChange={(e) => setSiteField('icp_no', e.target.value)} />
            <Input label="联系邮箱" maxLength={100} value={String(site.contact_email ?? '')} onChange={(e) => setSiteField('contact_email', e.target.value)} />
          </div>
        </Card>

        {/* 安全 */}
        <Card title="安全">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="访问令牌有效期(分钟)" type="number" min={5} max={1440} value={String(site.token_ttl_min ?? '')} onChange={(e) => setSiteField('token_ttl_min', e.target.value)} />
            <Input label="刷新令牌有效期(天)" type="number" min={1} max={365} value={String(site.refresh_ttl_days ?? '')} onChange={(e) => setSiteField('refresh_ttl_days', e.target.value)} />
            <Input label="聊天限流(条/分钟)" type="number" min={1} value={String(site.chat_rate_limit_per_min ?? '')} onChange={(e) => setSiteField('chat_rate_limit_per_min', e.target.value)} />
          </div>
          <div className="mt-3">
            <Switch label="启用短信验证码" hint="关闭后注册/登录跳过验证码校验（开发阶段可关闭）" checked={site.sms_enabled !== false} onChange={(v) => setSiteField('sms_enabled', v)} />
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Input label="短信限流(条/分钟/手机号)" type="number" min={1} value={String(site.sms_rate_limit_per_min ?? '')} onChange={(e) => setSiteField('sms_rate_limit_per_min', e.target.value)} />
          </div>
        </Card>

        {/* 上传 */}
        <Card title="上传">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="上传上限(MB)" type="number" min={1} max={100} value={String(site.upload_max_mb ?? '')} onChange={(e) => setSiteField('upload_max_mb', e.target.value)} />
            <Input label="允许类型" maxLength={100} placeholder="如：jpg,jpeg,png,pdf" value={String(site.upload_allowed_types ?? '')} onChange={(e) => setSiteField('upload_allowed_types', e.target.value)} />
            <Select label="存储后端" value={String(site.upload_driver ?? 'local')} onChange={(e) => setSiteField('upload_driver', e.target.value)}>
              <option value="local">本地</option>
              <option value="oss">阿里云 OSS</option>
              <option value="s3">S3 兼容</option>
            </Select>
            <Input label="上传基础地址" maxLength={300} placeholder="https://…（CDN/对象存储地址）" value={String(site.upload_base_url ?? '')} onChange={(e) => setSiteField('upload_base_url', e.target.value)} />
          </div>
        </Card>

        {/* 队列 */}
        <Card title="队列">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="重试次数" type="number" min={1} max={10} value={String(site.queue_attempts ?? '')} onChange={(e) => setSiteField('queue_attempts', e.target.value)} />
            <Input label="重试退避(ms)" type="number" min={100} value={String(site.queue_backoff_ms ?? '')} onChange={(e) => setSiteField('queue_backoff_ms', e.target.value)} />
          </div>
          <Switch label="启用死信队列(DLQ)" hint="失败消息进入死信队列便于排查" checked={!!site.queue_dlq_enabled} onChange={(v) => setSiteField('queue_dlq_enabled', v)} />
        </Card>

        {/* SEO */}
        <Card title="SEO">
          <div className="grid gap-4">
            <Input label="标题" maxLength={200} value={String(seo?.title ?? '')} onChange={(e) => setSeoField('title', e.target.value)} />
            <Input label="描述" maxLength={500} value={String(seo?.description ?? '')} onChange={(e) => setSeoField('description', e.target.value)} />
            <Input label="关键词" maxLength={300} placeholder="逗号分隔" value={String(seo?.keywords ?? '')} onChange={(e) => setSeoField('keywords', e.target.value)} />
            <Switch label="启用 Sitemap" hint="自动生成并输出 sitemap.xml" checked={!!seo?.sitemap_enabled} onChange={(v) => setSeoField('sitemap_enabled', v)} />
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}

export default function AdminConfigPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ConfigContent />
    </Suspense>
  );
}
