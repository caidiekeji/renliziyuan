'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ADMIN_NAV } from '@/lib/admin-nav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { PageLoading } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

interface Policy {
  id: string;
  key: string;
  title: string;
  version: number;
  status: string;
  content: string;
  published_at?: string | null;
  created_at: string;
}

interface PolicyForm {
  key: string;
  customKey: string;
  title: string;
  content: string;
  version: string;
}

// ================= 文案映射 =================
const SUGGESTED_KEYS = ['register-agreement', 'terms', 'privacy'];

const KEY_LABEL: Record<string, string> = {
  'register-agreement': '注册须知',
  terms: '使用须知',
  privacy: '隐私政策',
  'user-agreement': '用户协议',
};

const STATUS_META: Record<string, { tone: Tone; label: string }> = {
  DRAFT: { tone: 'warning', label: '草稿' },
  PUBLISHED: { tone: 'success', label: '已发布' },
  SUPERSEDED: { tone: 'neutral', label: '已取代' },
};

const CUSTOM_KEY = '__custom__';

// ---------- 页面 ----------
function PoliciesContent() {
  const { toast } = useToast();
  const guarding = useRoleGuard(['ADMIN'], '/');

  const [rows, setRows] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [publishing, setPublishing] = useState<Policy | null>(null);
  const [publishingLoading, setPublishingLoading] = useState(false);
  const [deleting, setDeleting] = useState<Policy | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PolicyForm>({ key: 'register-agreement', customKey: '', title: '', content: '', version: '' });

  const load = useCallback(() => {
    setLoading(true);
    api.get<Policy[]>('/api/admin/policies').then((r) => {
      if (r.ok) {
        setLoadFailed(false);
        setRows(r.data || []);
      } else {
        setLoadFailed(true);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** 按 key 分组（接口已按 key + version desc 排序） */
  const groups = useMemo(() => {
    const map = new Map<string, Policy[]>();
    for (const p of rows) {
      const arr = map.get(p.key) || [];
      arr.push(p);
      map.set(p.key, arr);
    }
    return Array.from(map.entries());
  }, [rows]);

  const set = <K extends keyof PolicyForm>(k: K, v: PolicyForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = (presetKey?: string) => {
    setEditing(null);
    setForm({ key: presetKey || 'register-agreement', customKey: '', title: '', content: '', version: '' });
    setOpen(true);
  };

  const openEdit = (p: Policy) => {
    setEditing(p);
    setForm({ key: p.key, customKey: '', title: p.title, content: p.content, version: String(p.version) });
    setOpen(true);
  };

  const submit = async () => {
    const key = form.key === CUSTOM_KEY ? form.customKey.trim() : form.key;
    if (!key) return toast('error', '请填写条款标识 key');
    if (!form.title.trim()) return toast('error', '请填写标题');
    if (!form.content.trim()) return toast('error', '请填写条款正文');
    const title = form.title.trim();
    const content = form.content.trim();
    setSaving(true);
    const res = editing
      ? await api.put(`/api/admin/policies/${editing.id}`, { title, content })
      : await api.post('/api/admin/policies', {
          key,
          title,
          content,
          version: form.version ? Number(form.version) : undefined,
        });
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', editing ? '已更新' : '已创建');
    setOpen(false);
    load();
  };

  const publish = async () => {
    if (!publishing) return;
    setPublishingLoading(true);
    const res = await api.post(`/api/admin/policies/${publishing.id}/publish`);
    setPublishingLoading(false);
    if (!res.ok) return toast('error', res.error?.message || '发布失败');
    toast('success', '已发布');
    setPublishing(null);
    load();
  };

  const remove = async () => {
    if (!deleting) return;
    setDeletingLoading(true);
    const res = await api.del(`/api/admin/policies/${deleting.id}`);
    setDeletingLoading(false);
    if (!res.ok) return toast('error', res.error?.message || '删除失败');
    toast('success', '已删除');
    setDeleting(null);
    load();
  };

  if (guarding) return <PageLoading />;

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="条款协议">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">条款协议管理</h1>
        <Button size="sm" onClick={() => openCreate()}>
          新建条款
        </Button>
      </div>

      {loading ? (
        <PageLoading />
      ) : loadFailed ? (
        <Empty
          title="条款列表加载失败"
          description="请检查网络后重试"
          action={
            <Button size="sm" variant="secondary" onClick={load}>
              重试
            </Button>
          }
        />
      ) : groups.length === 0 ? (
        <Empty title="暂无条款" description="点击右上角「新建条款」创建第一份协议" />
      ) : (
        <div className="space-y-4">
          {groups.map(([key, items]) => (
            <Card
              key={key}
              title={`${KEY_LABEL[key] || key}（${key}）`}
              action={
                <Button size="sm" variant="secondary" onClick={() => openCreate(key)}>
                  新建版本
                </Button>
              }
            >
              <div className="divide-y divide-border">
                {items.map((p) => {
                  const st = STATUS_META[p.status] || { tone: 'default' as Tone, label: p.status };
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-3">
                      <Badge tone="primary">v{p.version}</Badge>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-text">{p.title}</div>
                        <p className="mt-0.5 text-xs text-text-secondary">
                          {p.status === 'PUBLISHED'
                            ? `发布于 ${formatDateTime(p.published_at)}`
                            : `创建于 ${formatDateTime(p.created_at)}`}
                        </p>
                      </div>
                      {p.status === 'DRAFT' && (
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                            编辑
                          </Button>
                          <Button size="sm" variant="ghost" className="text-accent" onClick={() => setPublishing(p)}>
                            发布
                          </Button>
                          <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(p)}>
                            删除
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 新建 / 编辑 */}
      <Modal
        open={open}
        title={editing ? `编辑条款 v${editing.version}（${KEY_LABEL[editing.key] || editing.key}）` : '新建条款'}
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
          {!editing && (
            <>
              <Select label="条款 key" value={form.key} onChange={(e) => set('key', e.target.value)}>
                {SUGGESTED_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {KEY_LABEL[k] || k}（{k}）
                  </option>
                ))}
                <option value={CUSTOM_KEY}>自定义新 key…</option>
              </Select>
              {form.key === CUSTOM_KEY && (
                <Input
                  label="自定义 key"
                  maxLength={30}
                  placeholder="如：user-agreement"
                  value={form.customKey}
                  onChange={(e) => set('customKey', e.target.value)}
                />
              )}
              <Input
                label="版本号"
                type="number"
                min={1}
                placeholder="留空自动基于该 key 最新版本递增"
                value={form.version}
                onChange={(e) => set('version', e.target.value)}
              />
            </>
          )}
          <Input label="标题" maxLength={100} value={form.title} onChange={(e) => set('title', e.target.value)} />
          <Textarea label="正文" rows={8} placeholder="条款正文内容" value={form.content} onChange={(e) => set('content', e.target.value)} />
        </div>
      </Modal>

      {/* 发布确认 */}
      <ConfirmDialog
        open={!!publishing}
        title="发布条款"
        message={`确定发布「${publishing?.title || ''}」（v${publishing?.version || ''}）吗？发布后该 key 当前生效版本将替换为这一版。`}
        onConfirm={publish}
        onCancel={() => setPublishing(null)}
        confirmText="发布"
        danger={false}
        loading={publishingLoading}
      />

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleting}
        title="删除条款"
        message={`确定删除「${deleting?.title || ''}」（v${deleting?.version || ''}）吗？仅草稿可删除。`}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
        confirmText="删除"
        loading={deletingLoading}
      />
    </DashboardShell>
  );
}

export default function AdminPoliciesPage() {
  return <PoliciesContent />;
}
