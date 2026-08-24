'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ADMIN_NAV } from '@/lib/admin-nav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { PageLoading } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api } from '@/lib/api';

interface Industry {
  id: string;
  parent_id: string | null;
  name: string;
  code: string;
  sort: number;
  active: boolean;
  children?: Industry[];
}

interface IndustryForm {
  parent_id: string;
  name: string;
  code: string;
  sort: string;
  active: boolean;
}

const EMPTY_FORM: IndustryForm = { parent_id: '', name: '', code: '', sort: '0', active: true };

/** 兼容后端返回「树形（含 children）」或「带 parent_id 的平铺数组」 */
function buildTree(list: Industry[]): Industry[] {
  if (list.some((i) => i.children !== undefined)) {
    return list.map((i) => ({ ...i, children: i.children || [] }));
  }
  const map = new Map<string, Industry>();
  list.forEach((i) => map.set(i.id, { ...i, children: [] }));
  const roots: Industry[] = [];
  map.forEach((i) => {
    if (i.parent_id && map.has(i.parent_id)) map.get(i.parent_id)!.children!.push(i);
    else roots.push(i);
  });
  return roots;
}

function IndustryContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const { toast } = useToast();
  const [tree, setTree] = useState<Industry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Industry | null>(null);
  const [deleting, setDeleting] = useState<Industry | null>(null);
  const [form, setForm] = useState<IndustryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get<Industry[]>('/api/admin/industries').then((r) => {
      if (r.ok) setTree(buildTree(r.data || []));
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

  const openEdit = (it: Industry) => {
    setEditing(it);
    setForm({
      parent_id: it.parent_id || '',
      name: it.name,
      code: it.code,
      sort: String(it.sort ?? 0),
      active: !!it.active,
    });
    setOpen(true);
  };

  const set = <K extends keyof IndustryForm>(k: K, v: IndustryForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return toast('error', '请填写行业名称');
    if (!form.code.trim()) return toast('error', '请填写行业编码');
    const body = {
      parent_id: form.parent_id || null,
      name: form.name.trim(),
      code: form.code.trim(),
      sort: Number(form.sort) || 0,
      active: form.active,
    };
    setSaving(true);
    const res = editing
      ? await api.put(`/api/admin/industries/${editing.id}`, body)
      : await api.post('/api/admin/industries', body);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', editing ? '行业已更新' : '行业已创建');
    setOpen(false);
    load();
  };

  const toggle = async (it: Industry) => {
    setBusyId(it.id);
    const res = await api.put(`/api/admin/industries/${it.id}`, {
      parent_id: it.parent_id || null,
      name: it.name,
      code: it.code,
      sort: it.sort,
      active: !it.active,
    });
    setBusyId(null);
    if (!res.ok) return toast('error', res.error?.message || '操作失败');
    toast('success', it.active ? '已下线' : '已上线');
    load();
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    const res = await api.del(`/api/admin/industries/${deleting.id}`);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '删除失败');
    toast('success', '行业已删除');
    setDeleting(null);
    load();
  };

  const renderRow = (it: Industry, depth: number): React.ReactNode[] => {
    const hasChildren = (it.children?.length || 0) > 0;
    return [
      <tr key={it.id} className="border-b border-border/60 last:border-0 hover:bg-bg-subtle/60">
        <td className={`py-2.5 ${depth > 0 ? 'pl-12' : 'pl-3'}`}>
          <div className="flex items-center gap-2">
            {depth > 0 && <span className="shrink-0 text-xs text-text-secondary">└</span>}
            <span className="font-medium text-text">{it.name}</span>
            {hasChildren && <Badge tone="default">{it.children!.length} 子类</Badge>}
          </div>
        </td>
        <td className="px-3 py-2.5 text-text-secondary">{it.code}</td>
        <td className="px-3 py-2.5">
          <Badge tone={it.parent_id ? 'neutral' : 'primary'}>{it.parent_id ? '二级' : '一级'}</Badge>
        </td>
        <td className="px-3 py-2.5 text-text-secondary">{it.sort}</td>
        <td className="px-3 py-2.5">
          <Badge tone={it.active ? 'success' : 'neutral'}>{it.active ? '启用' : '停用'}</Badge>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="ghost" loading={busyId === it.id} onClick={() => toggle(it)}>
              {it.active ? '下线' : '上线'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openEdit(it)}>
              编辑
            </Button>
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(it)}>
              删除
            </Button>
          </div>
        </td>
      </tr>,
      ...(hasChildren ? it.children!.flatMap((c) => renderRow(c, depth + 1)) : []),
    ];
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="行业管理">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">行业管理</h1>
        <Button size="sm" onClick={openCreate}>
          新增一级行业
        </Button>
      </div>

      {loading ? (
        <PageLoading />
      ) : tree.length === 0 ? (
        <Empty title="暂无行业" description="点击「新增一级行业」创建第一个行业分类" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle text-xs text-text-secondary">
                  <th className="px-3 py-3 font-medium">行业名称</th>
                  <th className="px-3 py-3 font-medium">编码</th>
                  <th className="px-3 py-3 font-medium">级别</th>
                  <th className="px-3 py-3 font-medium">排序</th>
                  <th className="px-3 py-3 font-medium">状态</th>
                  <th className="px-3 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>{tree.flatMap((it) => renderRow(it, 0))}</tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={open}
        title={editing ? '编辑行业' : '新增行业'}
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
          <Select label="上级行业" value={form.parent_id} onChange={(e) => set('parent_id', e.target.value)}>
            <option value="">无（一级行业）</option>
            {tree.map((p) => (
              <option key={p.id} value={p.id} disabled={editing?.id === p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Input label="行业名称" maxLength={50} placeholder="如：互联网" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <Input label="行业编码" maxLength={20} placeholder="如：INTERNET（唯一）" value={form.code} onChange={(e) => set('code', e.target.value)} />
          <Input label="排序" type="number" value={form.sort} onChange={(e) => set('sort', e.target.value)} />
          <Switch label="启用" hint="停用后企业注册/编辑不可选择该行业" checked={form.active} onChange={(v) => set('active', v)} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="删除行业"
        message={`确定删除行业「${deleting?.name || ''}」吗？该操作不可恢复；含子分类或被企业/职位引用的行业不可删除。`}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
        confirmText="删除"
        loading={saving}
      />
    </DashboardShell>
  );
}

export default function AdminIndustriesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <IndustryContent />
    </Suspense>
  );
}
