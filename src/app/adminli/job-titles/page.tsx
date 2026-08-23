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

interface JobTitle {
  id: string;
  category: string;
  sub_category?: string | null;
  name: string;
  code: string;
  sort: number;
  active: boolean;
}

interface TitleForm {
  category: string;
  sub_category: string;
  name: string;
  code: string;
  sort: string;
  active: boolean;
}

const EMPTY_FORM: TitleForm = { category: '', sub_category: '', name: '', code: '', sort: '0', active: true };
const PAGE_SIZE = 20;

function JobTitlesContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const sp = useSearchParams();
  const { toast } = useToast();
  const page = Number(sp.get('page')) || 1;

  const [rows, setRows] = useState<JobTitle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobTitle | null>(null);
  const [deleting, setDeleting] = useState<JobTitle | null>(null);
  const [form, setForm] = useState<TitleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<JobTitle[]>('/api/admin/job-titles' + qs({ category, page, pageSize: PAGE_SIZE }))
      .then((r) => {
        if (r.ok) {
          setRows(r.data || []);
          setTotal(Number(r.meta?.total) || 0);
          setCategories((prev) => Array.from(new Set([...prev, ...r.data.map((d) => d.category).filter(Boolean)])));
        }
        setLoading(false);
      });
  }, [category, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (guarding) return <PageLoading />;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category });
    setOpen(true);
  };

  const openEdit = (it: JobTitle) => {
    setEditing(it);
    setForm({
      category: it.category,
      sub_category: it.sub_category || '',
      name: it.name,
      code: it.code,
      sort: String(it.sort ?? 0),
      active: !!it.active,
    });
    setOpen(true);
  };

  const set = <K extends keyof TitleForm>(k: K, v: TitleForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.category.trim()) return toast('error', '请填写一级分类');
    if (!form.name.trim()) return toast('error', '请填写职位名称');
    if (!form.code.trim()) return toast('error', '请填写职位编码');
    const body = {
      category: form.category.trim(),
      sub_category: form.sub_category.trim() || undefined,
      name: form.name.trim(),
      code: form.code.trim(),
      sort: Number(form.sort) || 0,
      active: form.active,
    };
    setSaving(true);
    const res = editing
      ? await api.put(`/api/admin/job-titles/${editing.id}`, body)
      : await api.post('/api/admin/job-titles', body);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', editing ? '职位名称已更新' : '职位名称已创建');
    setOpen(false);
    load();
  };

  const toggle = async (it: JobTitle) => {
    setBusyId(it.id);
    const res = await api.put(`/api/admin/job-titles/${it.id}`, {
      category: it.category,
      sub_category: it.sub_category || undefined,
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
    const res = await api.del(`/api/admin/job-titles/${deleting.id}`);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '删除失败');
    toast('success', '职位名称已删除');
    setDeleting(null);
    load();
  };

  /** 批量导入：每行 `分类|子分类|名称|编码`，子分类可省略为 `分类|名称|编码` */
  const parseImport = () => {
    const rows: { category: string; sub_category?: string; name: string; code: string }[] = [];
    const lines = importText.split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const parts = t.split('|').map((s) => s.trim());
      if (parts.length === 4 && parts.every(Boolean)) {
        rows.push({ category: parts[0], sub_category: parts[1], name: parts[2], code: parts[3] });
      } else if (parts.length === 3 && parts.every(Boolean)) {
        rows.push({ category: parts[0], name: parts[1], code: parts[2] });
      }
      // 其它情况（字段数不对或存在空字段）整行跳过
    }
    return rows;
  };

  const submitImport = async () => {
    const rows = parseImport();
    if (rows.length === 0) return toast('error', '请按格式输入至少一行数据');
    setImporting(true);
    const res = await api.post<{ created: number; updated: number }>('/api/admin/job-titles/import', { rows });
    setImporting(false);
    if (!res.ok) return toast('error', res.error?.message || '导入失败');
    const d = res.data || { created: 0, updated: 0 };
    toast('success', `导入完成：新增 ${d.created} 条，更新 ${d.updated} 条`);
    setImportOpen(false);
    setImportText('');
    load();
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="职位名称管理">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-text">职位名称管理</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
            批量导入
          </Button>
          <Button size="sm" onClick={openCreate}>
            新增职位名称
          </Button>
        </div>
      </div>

      <div className="mb-3 w-full sm:w-64">
        <Select label="一级分类筛选" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <PageLoading />
      ) : rows.length === 0 ? (
        <Empty title="暂无职位名称" description="点击「新增职位名称」或「批量导入」添加数据" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-secondary">
                <th className="px-4 py-2.5 font-medium">一级分类</th>
                <th className="px-4 py-2.5 font-medium">子分类</th>
                <th className="px-4 py-2.5 font-medium">名称</th>
                <th className="px-4 py-2.5 font-medium">编码</th>
                <th className="px-4 py-2.5 font-medium">排序</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((it) => (
                <tr key={it.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text">{it.category}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{it.sub_category || '-'}</td>
                  <td className="px-4 py-2.5 font-medium text-text">{it.name}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{it.code}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{it.sort}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={it.active ? 'success' : 'neutral'}>{it.active ? '启用' : '停用'}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />

      {/* 新增/编辑 */}
      <Modal
        open={open}
        title={editing ? '编辑职位名称' : '新增职位名称'}
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
          <Input label="一级分类" maxLength={50} placeholder="如：技术" value={form.category} onChange={(e) => set('category', e.target.value)} />
          <Input label="子分类" maxLength={50} placeholder="如：前端（可留空）" value={form.sub_category} onChange={(e) => set('sub_category', e.target.value)} />
          <Input label="职位名称" maxLength={100} placeholder="如：前端工程师" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <Input label="职位编码" maxLength={30} placeholder="如：FE_ENGINEER（唯一）" value={form.code} onChange={(e) => set('code', e.target.value)} />
          <Input label="排序" type="number" value={form.sort} onChange={(e) => set('sort', e.target.value)} />
          <Switch label="启用" hint="停用后发布职位不可选择该职位名称" checked={form.active} onChange={(v) => set('active', v)} />
        </div>
      </Modal>

      {/* 批量导入 */}
      <Modal
        open={importOpen}
        title="批量导入职位名称"
        onClose={() => setImportOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={importing}>
              取消
            </Button>
            <Button onClick={submitImport} loading={importing}>
              导入
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-text-secondary">
            每行一条：<span className="font-mono">分类|子分类|名称|编码</span>
            ，子分类可省略为 <span className="font-mono">分类|名称|编码</span>。编码重复的行将被更新。
          </p>
          <Textarea
            rows={10}
            placeholder={'技术|前端|前端工程师|FE_ENGINEER\n技术|后端|Java 开发|JAVA_DEV\n市场|运营|内容运营|CONTENT_OP'}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="删除职位名称"
        message={`确定删除职位名称「${deleting?.name || ''}」吗？该操作不可恢复；已被职位引用的名称不可删除。`}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
        confirmText="删除"
        loading={saving}
      />
    </DashboardShell>
  );
}

export default function AdminJobTitlesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <JobTitlesContent />
    </Suspense>
  );
}
