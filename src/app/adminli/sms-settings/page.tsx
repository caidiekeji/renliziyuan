'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ADMIN_NAV } from '@/lib/admin-nav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageLoading } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api } from '@/lib/api';

const PROVIDERS = ['ALIYUN', 'TENCENT', 'VOLCENGINE'] as const;
const PROVIDER_LABEL: Record<string, string> = { ALIYUN: '阿里云短信', TENCENT: '腾讯云短信', VOLCENGINE: '火山引擎短信' };

interface SmsConfig {
  id: string;
  provider: string;
  access_key: string;
  sign_name: string;
  template_code_login?: string | null;
  template_code_notify?: string | null;
  endpoint?: string | null;
  enabled: boolean;
  is_primary: boolean;
}

interface SmsForm {
  access_key: string;
  secret: string;
  sign_name: string;
  template_code_login: string;
  template_code_notify: string;
  endpoint: string;
  enabled: boolean;
  is_primary: boolean;
}

const EMPTY_FORM: SmsForm = {
  access_key: '',
  secret: '',
  sign_name: '',
  template_code_login: '',
  template_code_notify: '',
  endpoint: '',
  enabled: false,
  is_primary: false,
};

function SmsSettingsContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const { toast } = useToast();
  const [configs, setConfigs] = useState<SmsConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SmsForm>(EMPTY_FORM);

  const load = useCallback(() => {
    setLoading(true);
    api.get<SmsConfig[]>('/api/admin/sms-config').then((r) => {
      if (r.ok) setConfigs(r.data || []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (guarding) return <PageLoading />;

  const configOf = (provider: string) => configs.find((c) => c.provider === provider);

  const openEdit = (provider: string) => {
    const cfg = configOf(provider);
    setIsNew(!cfg);
    setEditingProvider(provider);
    setForm(cfg ? {
      access_key: cfg.access_key || '',
      secret: '',
      sign_name: cfg.sign_name || '',
      template_code_login: cfg.template_code_login || '',
      template_code_notify: cfg.template_code_notify || '',
      endpoint: cfg.endpoint || '',
      enabled: !!cfg.enabled,
      is_primary: !!cfg.is_primary,
    } : EMPTY_FORM);
    setOpen(true);
  };

  const set = <K extends keyof SmsForm>(k: K, v: SmsForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!editingProvider) return;
    if (!form.access_key.trim()) return toast('error', '请填写 AccessKey');
    if (!form.sign_name.trim()) return toast('error', '请填写签名');
    const body = {
      provider: editingProvider,
      access_key: form.access_key.trim(),
      secret: form.secret || undefined, // 留空表示不修改
      sign_name: form.sign_name.trim(),
      template_code_login: form.template_code_login.trim() || undefined,
      template_code_notify: form.template_code_notify.trim() || undefined,
      endpoint: form.endpoint.trim() || undefined,
      enabled: form.enabled,
      is_primary: form.is_primary,
    };
    setSaving(true);
    const res = isNew
      ? await api.post('/api/admin/sms-config', body)
      : await api.put(`/api/admin/sms-config/${editingProvider}`, body);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', isNew ? '短信渠道已新增' : '短信配置已保存');
    setOpen(false);
    load();
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="短信设置">
      <h1 className="mb-4 text-lg font-bold text-text">短信设置</h1>

      {loading ? (
        <PageLoading />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROVIDERS.map((p) => {
            const cfg = configOf(p);
            return (
              <Card key={p} className="flex flex-col p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-text">{PROVIDER_LABEL[p] || p}</h3>
                  {cfg ? (
                    <div className="flex gap-1">
                      {cfg.is_primary && <Badge tone="primary">默认</Badge>}
                      <Badge tone={cfg.enabled ? 'success' : 'neutral'}>{cfg.enabled ? '启用' : '停用'}</Badge>
                    </div>
                  ) : (
                    <Badge tone="neutral">未配置</Badge>
                  )}
                </div>
                {cfg ? (
                  <div className="mt-3 space-y-1 text-sm text-text-secondary">
                    <p>AccessKey：{cfg.access_key || '-'}</p>
                    <p>签名：{cfg.sign_name || '-'}</p>
                    <p>登录模板：{cfg.template_code_login || '-'}</p>
                    <p>通知模板：{cfg.template_code_notify || '-'}</p>
                    <p className="truncate">Endpoint：{cfg.endpoint || '-'}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-text-secondary">该渠道尚未配置，点击下方按钮进行配置。</p>
                )}
                <div className="mt-4 flex-1" />
                <Button size="sm" variant={cfg ? 'secondary' : 'primary'} onClick={() => openEdit(p)}>
                  {cfg ? '编辑配置' : '新增配置'}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && configs.length === 0 && (
        <div className="mt-2">
          <Empty title="尚未配置任何短信渠道" description="请为各渠道填写 AccessKey 与签名" />
        </div>
      )}

      <Modal
        open={open}
        title={`${isNew ? '新增' : '编辑'}${PROVIDER_LABEL[editingProvider || ''] || editingProvider || ''}`}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={submit} loading={saving}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="AccessKey" maxLength={200} value={form.access_key} onChange={(e) => set('access_key', e.target.value)} />
          <Input label="密钥（Secret）" type="password" maxLength={200} placeholder="留空表示不修改" value={form.secret} onChange={(e) => set('secret', e.target.value)} />
          <Input label="签名" maxLength={50} placeholder="如：职桥" value={form.sign_name} onChange={(e) => set('sign_name', e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="登录验证码模板" maxLength={50} placeholder="模板 Code" value={form.template_code_login} onChange={(e) => set('template_code_login', e.target.value)} />
            <Input label="通知模板" maxLength={50} placeholder="模板 Code" value={form.template_code_notify} onChange={(e) => set('template_code_notify', e.target.value)} />
          </div>
          <Input label="Endpoint" maxLength={300} placeholder="可留空使用默认接入点" value={form.endpoint} onChange={(e) => set('endpoint', e.target.value)} />
          <Switch label="启用该渠道" hint="多平台可同时配置，启用开关决定实际走哪家" checked={form.enabled} onChange={(v) => set('enabled', v)} />
          <Switch label="设为默认" hint="勾选后自动取消其他渠道的默认状态（主用，失败自动降级备选）" checked={form.is_primary} onChange={(v) => set('is_primary', v)} />
        </div>
      </Modal>
    </DashboardShell>
  );
}

export default function AdminSmsSettingsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <SmsSettingsContent />
    </Suspense>
  );
}
