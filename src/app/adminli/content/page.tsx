'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ADMIN_NAV } from '@/lib/admin-nav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { formatDate } from '@/lib/utils';

// ================= 公告 / Banner =================
interface Announcement {
  id: string;
  type: 'BANNER' | 'NOTICE';
  title: string;
  content?: string | null;
  image_url?: string | null;
  sort: number;
  active: boolean;
  start_at?: string | null;
  end_at?: string | null;
}

interface AnnouncementForm {
  type: string;
  title: string;
  content: string;
  image_url: string;
  sort: string;
  active: boolean;
  start_at: string;
  end_at: string;
}

// ================= 敏感词 =================
interface SensitiveWord {
  id: string;
  word: string;
  category?: string | null;
  scope: string;
}

interface SensitiveForm {
  word: string;
  category: string;
  scope: string;
}

// ================= 全站配置（site 子集） =================
interface SiteConfig {
  [key: string]: string | number | boolean | null | undefined;
}

/** ISO → datetime-local 输入框值 */
function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** datetime-local 值 → ISO（可空） */
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ---------- Tab 1: 公告/Banner ----------
function AnnouncementPanel() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AnnouncementForm>({
    type: 'NOTICE',
    title: '',
    content: '',
    image_url: '',
    sort: '0',
    active: true,
    start_at: '',
    end_at: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    api.get<Announcement[]>('/api/admin/announcements').then((r) => {
      if (r.ok) setRows(r.data || []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ type: 'NOTICE', title: '', content: '', image_url: '', sort: '0', active: true, start_at: '', end_at: '' });
    setOpen(true);
  };

  const openEdit = (it: Announcement) => {
    setEditing(it);
    setForm({
      type: it.type,
      title: it.title,
      content: it.content || '',
      image_url: it.image_url || '',
      sort: String(it.sort ?? 0),
      active: !!it.active,
      start_at: toLocalInput(it.start_at),
      end_at: toLocalInput(it.end_at),
    });
    setOpen(true);
  };

  const set = <K extends keyof AnnouncementForm>(k: K, v: AnnouncementForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) return toast('error', '请填写标题');
    const body = {
      type: form.type,
      title: form.title.trim(),
      content: form.content.trim() || undefined,
      image_url: form.image_url.trim() || undefined,
      sort: Number(form.sort) || 0,
      active: form.active,
      start_at: fromLocalInput(form.start_at),
      end_at: fromLocalInput(form.end_at),
    };
    setSaving(true);
    const res = editing
      ? await api.put(`/api/admin/announcements/${editing.id}`, body)
      : await api.post('/api/admin/announcements', body);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', editing ? '已更新' : '已创建');
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    const res = await api.del(`/api/admin/announcements/${deleting.id}`);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '删除失败');
    toast('success', '已删除');
    setDeleting(null);
    load();
  };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={openCreate}>
          新增公告/Banner
        </Button>
      </div>
      {loading ? (
        <PageLoading />
      ) : rows.length === 0 ? (
        <Empty title="暂无公告/Banner" />
      ) : (
        <div className="card divide-y divide-border">
          {rows.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
              <Badge tone={it.type === 'BANNER' ? 'primary' : 'default'}>{it.type === 'BANNER' ? 'Banner' : '公告'}</Badge>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-text">{it.title}</span>
                  <Badge tone={it.active ? 'success' : 'neutral'}>{it.active ? '启用' : '停用'}</Badge>
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">
                  {it.content || it.image_url || '-'}
                  {it.start_at || it.end_at
                    ? ` · ${formatDate(it.start_at)}~${formatDate(it.end_at)}`
                    : ''}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => openEdit(it)}>
                  编辑
                </Button>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(it)}>
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        title={editing ? '编辑公告/Banner' : '新增公告/Banner'}
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
          <Select label="类型" value={form.type} onChange={(e) => set('type', e.target.value)}>
            <option value="BANNER">Banner（首页轮播）</option>
            <option value="NOTICE">公告</option>
          </Select>
          <Input label="标题" maxLength={100} value={form.title} onChange={(e) => set('title', e.target.value)} />
          <Textarea label="内容" rows={3} maxLength={5000} placeholder="公告正文（Banner 可留空）" value={form.content} onChange={(e) => set('content', e.target.value)} />
          <Input label="图片地址" maxLength={500} placeholder="https://…（Banner 必填）" value={form.image_url} onChange={(e) => set('image_url', e.target.value)} />
          <Input label="排序" type="number" value={form.sort} onChange={(e) => set('sort', e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="开始时间" type="datetime-local" value={form.start_at} onChange={(e) => set('start_at', e.target.value)} />
            <Input label="结束时间" type="datetime-local" value={form.end_at} onChange={(e) => set('end_at', e.target.value)} />
          </div>
          <Switch label="启用" checked={form.active} onChange={(v) => set('active', v)} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="删除"
        message={`确定删除「${deleting?.title || ''}」吗？`}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
        confirmText="删除"
        loading={saving}
      />
    </div>
  );
}

// ---------- Tab 2: 敏感词 ----------
function SensitivePanel() {
  const sp = useSearchParams();
  const { toast } = useToast();
  const page = Number(sp.get('page')) || 1;
  const PAGE_SIZE = 20;

  const [rows, setRows] = useState<SensitiveWord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SensitiveWord | null>(null);
  const [deleting, setDeleting] = useState<SensitiveWord | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SensitiveForm>({ word: '', category: '', scope: 'ALL' });

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<SensitiveWord[]>('/api/admin/sensitive-words' + qs({ keyword, page, pageSize: PAGE_SIZE }))
      .then((r) => {
        if (r.ok) {
          setRows(r.data || []);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [keyword, page]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ word: '', category: '', scope: 'ALL' });
    setOpen(true);
  };

  const openEdit = (it: SensitiveWord) => {
    setEditing(it);
    setForm({ word: it.word, category: it.category || '', scope: it.scope || 'ALL' });
    setOpen(true);
  };

  const set = <K extends keyof SensitiveForm>(k: K, v: SensitiveForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.word.trim()) return toast('error', '请填写敏感词');
    const body = { word: form.word.trim(), category: form.category.trim() || undefined, scope: form.scope };
    setSaving(true);
    const res = editing
      ? await api.put(`/api/admin/sensitive-words/${editing.id}`, body)
      : await api.post('/api/admin/sensitive-words', body);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', editing ? '已更新' : '已创建');
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    const res = await api.del(`/api/admin/sensitive-words/${deleting.id}`);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '删除失败');
    toast('success', '已删除');
    setDeleting(null);
    load();
  };

  const SCOPE_LABEL: Record<string, string> = { ALL: '全部', JOB: '职位', REVIEW: '评价', CHAT: '聊天' };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="w-full sm:w-64">
          <Input label="关键词搜索" placeholder="搜索敏感词" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <Button size="sm" onClick={openCreate}>
          新增敏感词
        </Button>
      </div>
      {loading ? (
        <PageLoading />
      ) : rows.length === 0 ? (
        <Empty title="暂无敏感词" />
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle text-xs text-text-secondary">
                  <th className="px-3 py-3 font-medium">敏感词</th>
                  <th className="px-3 py-3 font-medium">分类</th>
                  <th className="px-3 py-3 font-medium">作用域</th>
                  <th className="px-3 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((it) => (
                  <tr key={it.id} className="border-b border-border last:border-0 hover:bg-bg-subtle/60">
                    <td className="px-3 py-2.5 font-medium text-text">{it.word}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{it.category || '-'}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone="warning">{SCOPE_LABEL[it.scope] || it.scope}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(it)}>
                          编辑
                        </Button>
                        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(it)}>
                          删除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-2 pb-2">
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
          </div>
        </div>
      )}

      <Modal
        open={open}
        title={editing ? '编辑敏感词' : '新增敏感词'}
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
          <Input label="敏感词" maxLength={100} value={form.word} onChange={(e) => set('word', e.target.value)} />
          <Input label="分类" maxLength={30} placeholder="如：政治/广告/色情（可留空）" value={form.category} onChange={(e) => set('category', e.target.value)} />
          <Select label="作用域" value={form.scope} onChange={(e) => set('scope', e.target.value)}>
            <option value="ALL">全部</option>
            <option value="JOB">职位</option>
            <option value="REVIEW">评价</option>
            <option value="CHAT">聊天</option>
          </Select>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="删除敏感词"
        message={`确定删除敏感词「${deleting?.word || ''}」吗？`}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
        confirmText="删除"
        loading={saving}
      />
    </div>
  );
}

// ---------- Tab 3: 全站开关 ----------
function SwitchesPanel() {
  const { toast } = useToast();
  const [site, setSite] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get<SiteConfig | { site?: SiteConfig }>('/api/admin/site-config').then((r) => {
      if (r.ok) {
        const d = (r.data ?? {}) as Record<string, unknown>;
        const hasSite = d.site && typeof d.site === 'object' && !Array.isArray(d.site);
        setSite(hasSite ? (d.site as SiteConfig) : (d as unknown as SiteConfig));
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageLoading />;
  if (!site) return <Empty title="全站配置加载失败" description="请确认 /api/admin/site-config 已初始化" />;

  const set = (k: string, v: string | number | boolean) => setSite((s) => (s ? { ...s, [k]: v } : s));

  const save = async () => {
    if (!site) return;
    const body = {
      site: {
        register_enabled: !!site.register_enabled,
        chat_enabled: !!site.chat_enabled,
        payment_enabled: !!site.payment_enabled,
        audit_mode: site.audit_mode || 'POST',
        reply_review_review: !!site.reply_review_review,
        notify_by_sms: !!site.notify_by_sms,
        maintenance_mode: !!site.maintenance_mode,
        maintenance_msg: String(site.maintenance_msg ?? ''),
      },
    };
    setSaving(true);
    const res = await api.put('/api/admin/site-config', body);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', '全站开关已保存');
  };

  return (
    <div>
      <div className="card p-6">
        <div className="divide-y divide-border">
          <Switch label="开放注册" hint="关闭后新用户无法注册" checked={!!site.register_enabled} onChange={(v) => set('register_enabled', v)} />
          <Switch label="开启聊天" hint="关闭后全部聊天功能停用" checked={!!site.chat_enabled} onChange={(v) => set('chat_enabled', v)} />
          <Switch label="开启支付" hint="关闭后购买套餐/支付不可用" checked={!!site.payment_enabled} onChange={(v) => set('payment_enabled', v)} />
          <Select label="审核模式" value={String(site.audit_mode || 'POST')} onChange={(e) => set('audit_mode', e.target.value)}>
            <option value="PRE">先审后发</option>
            <option value="POST">先发后审</option>
          </Select>
          <Switch label="评价回复需审核" checked={!!site.reply_review_review} onChange={(v) => set('reply_review_review', v)} />
          <Switch label="短信通知" hint="重要事件通过短信通知用户" checked={!!site.notify_by_sms} onChange={(v) => set('notify_by_sms', v)} />
          <Switch label="维护模式" hint="开启后全站提示维护" checked={!!site.maintenance_mode} onChange={(v) => set('maintenance_mode', v)} />
          <Input label="维护提示语" maxLength={200} value={String(site.maintenance_msg ?? '')} onChange={(e) => set('maintenance_msg', e.target.value)} />
        </div>
        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <Button onClick={save} loading={saving}>
            保存开关设置
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- 页面 ----------
const TABS = [
  { key: 'announcement', label: '公告/Banner' },
  { key: 'sensitive', label: '敏感词' },
  { key: 'switches', label: '全站开关' },
];

function ContentPageInner() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const [tab, setTab] = useState('announcement');

  if (guarding) return <PageLoading />;

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="运营内容">
      <h1 className="mb-5 text-xl font-semibold text-text">运营内容</h1>

      <div className="mb-4 flex gap-1 rounded-lg bg-bg-subtle p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-text shadow-sm' : 'text-text-secondary hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'announcement' && <AnnouncementPanel />}
      {tab === 'sensitive' && <SensitivePanel />}
      {tab === 'switches' && <SwitchesPanel />}
    </DashboardShell>
  );
}

export default function AdminContentPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ContentPageInner />
    </Suspense>
  );
}
