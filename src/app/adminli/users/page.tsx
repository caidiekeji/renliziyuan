'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { ROLE_LABEL, USER_STATUS_LABEL, formatDateTime } from '@/lib/utils';
import { ADMIN_NAV } from '@/lib/admin-nav';

interface AdminUser {
  id: string;
  phone: string;
  name: string;
  avatar?: string | null;
  role: string;
  status: string;
  city?: string | null;
  title?: string | null;
  created_at?: string;
  last_login_at?: string | null;
  deleted_at?: string | null;
}

const ROLE_OPTIONS = [
  { value: '', label: '全部角色' },
  { value: 'CANDIDATE', label: '求职者' },
  { value: 'COMPANY', label: '企业' },
  { value: 'ADMIN', label: '管理员' },
];

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'ACTIVE', label: '正常' },
  { value: 'BANNED', label: '已封禁' },
];

function UsersContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;

  const keyword = sp.get('keyword') || '';
  const role = sp.get('role') || '';
  const status = sp.get('status') || '';

  const [kwInput, setKwInput] = useState(keyword);
  const [roleInput, setRoleInput] = useState(role);
  const [statusInput, setStatusInput] = useState(status);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  // 封禁 / 解封
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banLoading, setBanLoading] = useState(false);

  // 改角色
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState('CANDIDATE');
  const [roleSaving, setRoleSaving] = useState(false);

  // 注销
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 新增用户
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ phone: '', name: '', role: 'CANDIDATE', password: '' });
  const [createSaving, setCreateSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<AdminUser[]>('/api/admin/users' + qs({ keyword, role, status, page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setUsers(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [keyword, role, status, page, reloadKey]);

  if (guarding) return <PageLoading />;

  const applyFilter = () => {
    const params = new URLSearchParams(sp.toString());
    if (kwInput) params.set('keyword', kwInput);
    else params.delete('keyword');
    if (roleInput) params.set('role', roleInput);
    else params.delete('role');
    if (statusInput) params.set('status', statusInput);
    else params.delete('status');
    params.delete('page');
    router.replace(`/adminli/users${params.toString() ? `?${params}` : ''}`);
  };

  const toggleBan = async () => {
    if (!banTarget) return;
    setBanLoading(true);
    const next = banTarget.status === 'BANNED' ? 'ACTIVE' : 'BANNED';
    const res = await api.put(`/api/admin/users/${banTarget.id}`, { status: next });
    setBanLoading(false);
    if (!res.ok) {
      toast('error', res.error?.message || '操作失败');
      setBanTarget(null);
      return;
    }
    toast('success', next === 'BANNED' ? `已封禁 ${banTarget.name}` : `已解封 ${banTarget.name}`);
    setBanTarget(null);
    reload();
  };

  const openRoleModal = (u: AdminUser) => {
    setRoleTarget(u);
    setNewRole(u.role);
  };

  const saveRole = async () => {
    if (!roleTarget) return;
    setRoleSaving(true);
    const res = await api.put(`/api/admin/users/${roleTarget.id}`, { role: newRole });
    setRoleSaving(false);
    if (!res.ok) {
      toast('error', res.error?.message || '修改失败');
      return;
    }
    toast('success', '角色已更新');
    setRoleTarget(null);
    reload();
  };

  const removeUser = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const res = await api.del(`/api/admin/users/${deleteTarget.id}`);
    setDeleteLoading(false);
    if (!res.ok) {
      toast('error', res.error?.message || '注销失败');
      setDeleteTarget(null);
      return;
    }
    toast('success', '用户已注销');
    setDeleteTarget(null);
    reload();
  };

  const createUser = async () => {
    if (!createForm.phone || !createForm.name) {
      toast('error', '请填写手机号和姓名');
      return;
    }
    setCreateSaving(true);
    const res = await api.post('/api/admin/users', {
      phone: createForm.phone,
      name: createForm.name,
      role: createForm.role,
      password: createForm.password || undefined,
    });
    setCreateSaving(false);
    if (!res.ok) {
      toast('error', res.error?.message || '创建失败');
      return;
    }
    toast('success', '用户已创建');
    setCreateOpen(false);
    setCreateForm({ phone: '', name: '', role: 'CANDIDATE', password: '' });
    reload();
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="用户管理">
      <h1 className="mb-4 text-lg font-bold text-text">用户管理（{total}）</h1>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-56">
            <Input
              label="搜索"
              placeholder="手机号 / 姓名"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            />
          </div>
          <div className="w-full sm:w-40">
            <Select label="角色" options={ROLE_OPTIONS} value={roleInput} onChange={(e) => setRoleInput(e.target.value)} />
          </div>
          <div className="w-full sm:w-40">
            <Select label="状态" options={STATUS_OPTIONS} value={statusInput} onChange={(e) => setStatusInput(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilter}>搜索</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setKwInput('');
                setRoleInput('');
                setStatusInput('');
                router.replace('/adminli/users');
              }}
            >
              重置
            </Button>
          </div>
          <div className="ml-auto">
            <Button onClick={() => setCreateOpen(true)}>新增用户</Button>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <PageLoading />
        ) : users.length === 0 ? (
          <Empty title="暂无用户" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-secondary">
                  <th className="px-3 py-2 font-medium">姓名</th>
                  <th className="px-3 py-2 font-medium">手机号</th>
                  <th className="px-3 py-2 font-medium">角色</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                  <th className="px-3 py-2 font-medium">城市</th>
                  <th className="px-3 py-2 font-medium">注册时间</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0 hover:bg-bg-subtle/60">
                    <td className="px-3 py-2.5 font-medium text-text">{u.name}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{u.phone}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={u.role === 'ADMIN' ? 'primary' : u.role === 'COMPANY' ? 'success' : 'default'}>
                        {ROLE_LABEL[u.role] || u.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={u.status === 'ACTIVE' ? 'success' : 'danger'}>{USER_STATUS_LABEL[u.status] || u.status}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{u.city || '-'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{formatDateTime(u.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {u.status === 'BANNED' ? (
                          <Button variant="secondary" size="sm" onClick={() => setBanTarget(u)}>
                            解封
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setBanTarget(u)}>
                            封禁
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openRoleModal(u)}>
                          改角色
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(u)}>
                          注销
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-2 pb-2">
          <Pagination page={page} pageSize={pageSize} total={total} />
        </div>
      </Card>

      {/* 封禁 / 解封确认 */}
      <ConfirmDialog
        open={!!banTarget}
        title={banTarget?.status === 'BANNED' ? '解封用户' : '封禁用户'}
        message={
          banTarget?.status === 'BANNED'
            ? `确定解封「${banTarget?.name}」吗？解封后该用户可正常登录使用。`
            : `确定封禁「${banTarget?.name}」吗？封禁后该用户将无法登录。`
        }
        confirmText={banTarget?.status === 'BANNED' ? '解封' : '封禁'}
        danger={banTarget?.status !== 'BANNED'}
        onConfirm={toggleBan}
        onCancel={() => setBanTarget(null)}
        loading={banLoading}
      />

      {/* 注销确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="注销用户"
        message={`确定注销「${deleteTarget?.name || ''}」吗？该操作会释放其手机号，且不可恢复。`}
        confirmText="注销"
        onConfirm={removeUser}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />

      {/* 改角色 */}
      <Modal
        open={!!roleTarget}
        title={`修改角色 - ${roleTarget?.name || ''}`}
        onClose={() => setRoleTarget(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRoleTarget(null)} disabled={roleSaving}>
              取消
            </Button>
            <Button onClick={saveRole} loading={roleSaving}>
              保存
            </Button>
          </>
        }
      >
        <Select
          label="角色"
          options={[
            { value: 'CANDIDATE', label: '求职者' },
            { value: 'COMPANY', label: '企业' },
            { value: 'ADMIN', label: '管理员' },
          ]}
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
        />
      </Modal>

      {/* 新增用户 */}
      <Modal
        open={createOpen}
        title="新增用户"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={createSaving}>
              取消
            </Button>
            <Button onClick={createUser} loading={createSaving}>
              创建
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="手机号"
            placeholder="11 位手机号"
            value={createForm.phone}
            onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
          />
          <Input
            label="姓名"
            placeholder="用户姓名"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
          />
          <Select
            label="角色"
            options={[
              { value: 'CANDIDATE', label: '求职者' },
              { value: 'COMPANY', label: '企业' },
              { value: 'ADMIN', label: '管理员' },
            ]}
            value={createForm.role}
            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
          />
          <Input
            label="初始密码（可选）"
            type="password"
            placeholder="留空则默认无密码"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
          />
        </div>
      </Modal>
    </DashboardShell>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <UsersContent />
    </Suspense>
  );
}
