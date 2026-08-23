'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ADMIN_NAV } from '@/lib/admin-nav';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';

interface CityItem {
  id: string;
  name: string;
  province?: string | null;
  lat: number | string;
  lng: number | string;
  coord_type?: string | null;
}

interface CityForm {
  name: string;
  province: string;
  lat: string;
  lng: string;
  coord_type: string;
}

const EMPTY_FORM: CityForm = { name: '', province: '', lat: '', lng: '', coord_type: 'GCJ02' };
const PAGE_SIZE = 20;
const COORD_TYPES = ['GCJ02', 'BD09', 'WGS84'];

function CitiesContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const sp = useSearchParams();
  const { toast } = useToast();
  const page = Number(sp.get('page')) || 1;

  const [rows, setRows] = useState<CityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [province, setProvince] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CityItem | null>(null);
  const [deleting, setDeleting] = useState<CityItem | null>(null);
  const [form, setForm] = useState<CityForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<CityItem[]>('/api/admin/cities' + qs({ province, page, pageSize: PAGE_SIZE }))
      .then((r) => {
        if (r.ok) {
          setRows(r.data || []);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [province, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (guarding) return <PageLoading />;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (it: CityItem) => {
    setEditing(it);
    setForm({
      name: it.name,
      province: it.province || '',
      lat: String(it.lat ?? ''),
      lng: String(it.lng ?? ''),
      coord_type: it.coord_type || 'GCJ02',
    });
    setOpen(true);
  };

  const set = <K extends keyof CityForm>(k: K, v: CityForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return toast('error', '请填写城市名称');
    if (form.lat === '' || Number.isNaN(Number(form.lat))) return toast('error', '请填写正确的纬度');
    if (form.lng === '' || Number.isNaN(Number(form.lng))) return toast('error', '请填写正确的经度');
    const body = {
      name: form.name.trim(),
      province: form.province.trim() || undefined,
      lat: Number(form.lat),
      lng: Number(form.lng),
      coord_type: form.coord_type,
    };
    setSaving(true);
    const res = editing
      ? await api.put(`/api/admin/cities/${editing.id}`, body)
      : await api.post('/api/admin/cities', body);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', editing ? '城市已更新' : '城市已创建');
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    const res = await api.del(`/api/admin/cities/${deleting.id}`);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '删除失败');
    toast('success', '城市已删除');
    setDeleting(null);
    load();
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="城市库">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-text">城市库</h1>
        <Button size="sm" onClick={openCreate}>
          新增城市
        </Button>
      </div>

      <div className="mb-3 w-full sm:w-64">
        <Input label="省份筛选" placeholder="如：浙江（支持模糊）" value={province} onChange={(e) => setProvince(e.target.value)} />
      </div>

      {loading ? (
        <PageLoading />
      ) : rows.length === 0 ? (
        <Empty title="暂无城市" description="点击「新增城市」添加坐标" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-secondary">
                  <th className="px-3 py-2 font-medium">城市</th>
                  <th className="px-3 py-2 font-medium">省份</th>
                  <th className="px-3 py-2 font-medium">纬度</th>
                  <th className="px-3 py-2 font-medium">经度</th>
                  <th className="px-3 py-2 font-medium">坐标系</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((it) => (
                  <tr key={it.id} className="border-b border-border/60 last:border-0 hover:bg-bg-subtle/60">
                    <td className="px-3 py-2.5 font-medium text-text">{it.name}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{it.province || '-'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{String(it.lat)}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{String(it.lng)}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{it.coord_type || 'GCJ02'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
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
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />

      <Modal
        open={open}
        title={editing ? '编辑城市' : '新增城市'}
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
          <Input label="城市名称" maxLength={50} placeholder="如：杭州" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <Input label="省份" maxLength={50} placeholder="如：浙江" value={form.province} onChange={(e) => set('province', e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="纬度" type="number" step="any" placeholder="如：30.2741" value={form.lat} onChange={(e) => set('lat', e.target.value)} />
            <Input label="经度" type="number" step="any" placeholder="如：120.1551" value={form.lng} onChange={(e) => set('lng', e.target.value)} />
          </div>
          <Select label="坐标系" value={form.coord_type} onChange={(e) => set('coord_type', e.target.value)}>
            {COORD_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="删除城市"
        message={`确定删除城市「${deleting?.name || ''}」吗？该操作不可恢复。`}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
        confirmText="删除"
        loading={saving}
      />
    </DashboardShell>
  );
}

export default function AdminCitiesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CitiesContent />
    </Suspense>
  );
}
