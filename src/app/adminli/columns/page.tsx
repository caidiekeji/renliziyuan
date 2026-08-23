'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ADMIN_NAV } from '@/lib/admin-nav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { PageLoading } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api } from '@/lib/api';

interface NavMenu {
  id: string;
  label: string;
  href: string;
  sort: number;
  active: boolean;
}

interface MenuForm {
  label: string;
  href: string;
  sort: string;
  active: boolean;
}

const EMPTY_FORM: MenuForm = { label: '', href: '', sort: '0', active: true };

function ColumnsContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const { toast } = useToast();
  const [menus, setMenus] = useState<NavMenu[]>([]);
  const [logo, setLogo] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [logoBusy, setLogoBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NavMenu | null>(null);
  const [deleting, setDeleting] = useState<NavMenu | null>(null);
  const [form, setForm] = useState<MenuForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<NavMenu[]>('/api/admin/nav-menus'),
      api.get<{ site?: { site_logo?: string | null } } | { site_logo?: string | null }>('/api/admin/site-config'),
    ]).then(([menuRes, cfgRes]) => {
      if (menuRes.ok) setMenus(menuRes.data || []);
      if (cfgRes.ok) {
        const d = cfgRes.data || {};
        const site = (d as { site?: { site_logo?: string | null } }).site;
        const siteLogo = site ? site.site_logo : (d as { site_logo?: string | null }).site_logo;
        setLogo(siteLogo || '');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (guarding) return <PageLoading />;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (it: NavMenu) => {
    setEditing(it);
    setForm({ label: it.label, href: it.href, sort: String(it.sort ?? 0), active: !!it.active });
    setOpen(true);
  };

  const set = <K extends keyof MenuForm>(k: K, v: MenuForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.label.trim()) return toast('error', '请填写栏目名称');
    if (!form.href.trim()) return toast('error', '请填写栏目链接');
    if (!form.href.startsWith('/')) return toast('error', '链接需以 / 开头（站内路径）');
    const body = { label: form.label.trim(), href: form.href.trim(), sort: Number(form.sort) || 0, active: form.active };
    setSaving(true);
    const res = editing
      ? await api.put(`/api/admin/nav-menus/${editing.id}`, body)
      : await api.post('/api/admin/nav-menus', body);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', editing ? '栏目已更新' : '栏目已创建');
    setOpen(false);
    load();
  };

  const toggle = async (it: NavMenu) => {
    setBusyId(it.id);
    const res = await api.put(`/api/admin/nav-menus/${it.id}`, {
      label: it.label,
      href: it.href,
      sort: it.sort,
      active: !it.active,
    });
    setBusyId(null);
    if (!res.ok) return toast('error', res.error?.message || '操作失败');
    toast('success', it.active ? '已停用' : '已启用');
    load();
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    const res = await api.del(`/api/admin/nav-menus/${deleting.id}`);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '删除失败');
    toast('success', '栏目已删除');
    setDeleting(null);
    load();
  };

  const onPickLogo = () => fileRef.current?.click();

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('error', '请选择图片文件');
    setLogoBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data?.url) {
        toast('error', json?.message || '上传失败');
        return;
      }
      // 存储相对路径，避免写死上传基础域名（CDN/生产域名不一致）
      const rel = `/uploads/${String(json.data.path || '').replace(/\\/g, '/')}`;
      const save = await api.put('/api/admin/site-config', { site: { site_logo: rel } });
      if (!save.ok) {
        toast('error', save.error?.message || 'Logo 保存失败');
        return;
      }
      setLogo(rel);
      toast('success', 'Logo 已更新');
    } finally {
      setLogoBusy(false);
    }
  };

  const clearLogo = async () => {
    setLogoBusy(true);
    const res = await api.put('/api/admin/site-config', { site: { site_logo: null } });
    setLogoBusy(false);
    if (!res.ok) return toast('error', res.error?.message || '移除失败');
    setLogo('');
    toast('success', 'Logo 已移除，前台将回退为文字标识');
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="栏目管理">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-text">栏目管理</h1>
        <Button size="sm" onClick={openCreate}>
          新增栏目
        </Button>
      </div>

      <div className="space-y-4">
        {/* Logo */}
        <div className="card p-4">
          <p className="mb-1 text-sm font-semibold text-text">网站 Logo</p>
          <p className="mb-3 text-xs text-text-secondary">用于前台页头与后台侧栏品牌标识，未设置时自动回退为站点名称首字。</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-border bg-bg-subtle">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-lg font-bold text-text-secondary">无</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
              <Button size="sm" onClick={onPickLogo} loading={logoBusy}>
                上传 Logo
              </Button>
              {logo && (
                <Button size="sm" variant="ghost" onClick={clearLogo} disabled={logoBusy}>
                  移除
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 一级菜单 */}
        <div className="card overflow-hidden">
          {loading ? (
            <PageLoading />
          ) : menus.length === 0 ? (
            <Empty title="暂无栏目" description="点击「新增栏目」创建前台首页一级菜单" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-text-secondary">
                    <th className="px-3 py-2 font-medium">栏目名称</th>
                    <th className="px-3 py-2 font-medium">链接</th>
                    <th className="px-3 py-2 font-medium">排序</th>
                    <th className="px-3 py-2 font-medium">状态</th>
                    <th className="px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {menus.map((it) => (
                    <tr key={it.id} className="border-b border-border/60 last:border-0 hover:bg-bg-subtle/60">
                      <td className="px-3 py-2.5 font-medium text-text">{it.label}</td>
                      <td className="px-3 py-2.5 text-text-secondary">{it.href}</td>
                      <td className="px-3 py-2.5 text-text-secondary">{it.sort}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={it.active ? 'success' : 'neutral'}>{it.active ? '启用' : '停用'}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" variant="ghost" loading={busyId === it.id} onClick={() => toggle(it)}>
                            {it.active ? '停用' : '启用'}
                          </Button>
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
          )}
        </div>
      </div>

      <Modal
        open={open}
        title={editing ? '编辑栏目' : '新增栏目'}
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
          <Input label="栏目名称" maxLength={50} placeholder="如：职位" value={form.label} onChange={(e) => set('label', e.target.value)} />
          <Input label="链接" maxLength={200} placeholder="如：/jobs（站内路径）" value={form.href} onChange={(e) => set('href', e.target.value)} />
          <Input label="排序" type="number" placeholder="数字越小越靠前" value={form.sort} onChange={(e) => set('sort', e.target.value)} />
          <Switch label="启用" hint="停用后前台首页不再展示该栏目" checked={form.active} onChange={(v) => set('active', v)} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="删除栏目"
        message={`确定删除栏目「${deleting?.label || ''}」吗？该操作不可恢复。`}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
        confirmText="删除"
        loading={saving}
      />
    </DashboardShell>
  );
}

export default function AdminColumnsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ColumnsContent />
    </Suspense>
  );
}