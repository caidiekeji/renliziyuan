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

const CHANNELS = ['ALIPAY', 'WECHAT'] as const;
const CHANNEL_LABEL: Record<string, string> = { ALIPAY: '支付宝', WECHAT: '微信支付' };

interface PaymentConfig {
  id: string;
  channel: string;
  merchant_id: string;
  gateway_url?: string | null;
  sandbox: boolean;
  active: boolean;
}

interface PayForm {
  merchant_id: string;
  secret: string;
  cert_serial: string;
  gateway_url: string;
  sandbox: boolean;
  active: boolean;
}

const EMPTY_FORM: PayForm = { merchant_id: '', secret: '', cert_serial: '', gateway_url: '', sandbox: false, active: true };

function PaymentSettingsContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const { toast } = useToast();
  const [configs, setConfigs] = useState<PaymentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<string | null>(null); // 当前编辑渠道
  const [isNew, setIsNew] = useState(false); // 渠道尚未配置时走 POST 新增
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PayForm>(EMPTY_FORM);

  const load = useCallback(() => {
    setLoading(true);
    api.get<PaymentConfig[]>('/api/admin/payment-config').then((r) => {
      if (r.ok) setConfigs(r.data || []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (guarding) return <PageLoading />;

  const configOf = (channel: string) => configs.find((c) => c.channel === channel);

  const openEdit = (channel: string) => {
    const cfg = configOf(channel);
    setIsNew(!cfg);
    setEditingChannel(channel);
    setForm(cfg ? {
      merchant_id: cfg.merchant_id || '',
      secret: '',
      cert_serial: '',
      gateway_url: cfg.gateway_url || '',
      sandbox: !!cfg.sandbox,
      active: !!cfg.active,
    } : EMPTY_FORM);
    setOpen(true);
  };

  const set = <K extends keyof PayForm>(k: K, v: PayForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!editingChannel) return;
    if (!form.merchant_id.trim()) return toast('error', '请填写商户号');
    const body = {
      channel: editingChannel,
      merchant_id: form.merchant_id.trim(),
      secret: form.secret || undefined, // 留空表示不修改
      cert_serial: form.cert_serial.trim() || undefined,
      gateway_url: form.gateway_url.trim() || undefined,
      sandbox: form.sandbox,
      active: form.active,
    };
    setSaving(true);
    const res = isNew
      ? await api.post('/api/admin/payment-config', body)
      : await api.put(`/api/admin/payment-config/${editingChannel}`, body);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', isNew ? '支付渠道已新增' : '支付配置已保存');
    setOpen(false);
    load();
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="支付设置">
      <h1 className="mb-5 text-xl font-semibold text-text">支付设置</h1>

      {loading ? (
        <PageLoading />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.map((ch) => {
            const cfg = configOf(ch);
            return (
              <Card key={ch} className="flex flex-col p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-text">{CHANNEL_LABEL[ch] || ch}</h3>
                  {cfg ? (
                    <div className="flex gap-1">
                      <Badge tone={cfg.active ? 'success' : 'neutral'}>{cfg.active ? '启用' : '停用'}</Badge>
                      <Badge tone={cfg.sandbox ? 'warning' : 'default'}>{cfg.sandbox ? '沙箱' : '生产'}</Badge>
                    </div>
                  ) : (
                    <Badge tone="neutral">未配置</Badge>
                  )}
                </div>
                {cfg ? (
                  <div className="mt-3 space-y-1 text-sm text-text-secondary">
                    <p>商户号：{cfg.merchant_id || '-'}</p>
                    <p className="truncate">网关：{cfg.gateway_url || '-'}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-text-secondary">该渠道尚未配置，点击下方按钮进行配置。</p>
                )}
                <div className="mt-4 flex-1" />
                <Button size="sm" variant={cfg ? 'secondary' : 'primary'} onClick={() => openEdit(ch)}>
                  {cfg ? '编辑配置' : '新增配置'}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && configs.length === 0 && (
        <div className="mt-2">
          <Empty title="尚未配置任何支付渠道" description="请为各渠道填写商户信息" />
        </div>
      )}

      <Modal
        open={open}
        title={`${isNew ? '新增' : '编辑'}${CHANNEL_LABEL[editingChannel || ''] || editingChannel || ''}配置`}
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
          <Input label="商户号" maxLength={64} placeholder="商户 ID / AppID" value={form.merchant_id} onChange={(e) => set('merchant_id', e.target.value)} />
          <Input label="密钥（Secret）" type="password" maxLength={200} placeholder="留空表示不修改" value={form.secret} onChange={(e) => set('secret', e.target.value)} />
          <Input label="证书序列号（cert_serial）" maxLength={64} placeholder="部分渠道需要（可留空）" value={form.cert_serial} onChange={(e) => set('cert_serial', e.target.value)} />
          <Input label="网关地址" maxLength={300} placeholder="https://…（可留空使用默认网关）" value={form.gateway_url} onChange={(e) => set('gateway_url', e.target.value)} />
          <Switch label="沙箱模式" hint="开启后走沙箱环境，关闭为生产环境" checked={form.sandbox} onChange={(v) => set('sandbox', v)} />
          <Switch label="启用该渠道" hint="关闭后用户无法选择该支付渠道" checked={form.active} onChange={(v) => set('active', v)} />
        </div>
      </Modal>
    </DashboardShell>
  );
}

export default function AdminPaymentSettingsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <PaymentSettingsContent />
    </Suspense>
  );
}
