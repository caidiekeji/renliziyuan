'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompanyShell } from '@/components/company/CompanyShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { PageLoading } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { useRoleGuard } from '@/lib/route-guard';
import { api } from '@/lib/api';
import { useMyCompanies, type MemberItem, COMPANY_ROLE_LABEL, MEMBER_STATUS_LABEL } from '@/lib/company';

const ROLE_OPTIONS = [
  { value: 'OWNER', label: '所有者' },
  { value: 'HR', label: '管理员' },
  { value: 'VIEWER', label: '查看者' },
];

export default function CompanyMembersPage() {
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const { current, loading } = useMyCompanies();

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState('HR');
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<MemberItem | null>(null);
  const [removingLoading, setRemovingLoading] = useState(false);

  const companyId = current?.company.id;
  const isOwner = current?.role === 'OWNER';
  const currentUserId = user?.id;

  useEffect(() => {
    if (loading) return;
    if (!current) {
      router.replace('/company/switch');
      return;
    }
  }, [loading, current, router]);

  useEffect(() => {
    if (!companyId) return;
    setDataLoading(true);
    api.get<MemberItem[]>(`/api/companies/${companyId}/members`).then((r) => {
      if (r.ok) setMembers(r.data);
      setDataLoading(false);
    });
  }, [companyId]);

  if (guarding) return <PageLoading />;
  if (loading || !current) return <PageLoading />;

  const reload = () => {
    if (!companyId) return;
    api.get<MemberItem[]>(`/api/companies/${companyId}/members`).then((r) => r.ok && setMembers(r.data));
  };

  const openInvite = () => {
    setInvitePhone('');
    setInviteRole('HR');
    setInviteOpen(true);
  };

  const invite = async () => {
    if (!companyId) return;
    if (!/^1[3-9]\d{9}$/.test(invitePhone.trim())) return toast('error', '请输入正确的手机号');
    setInviting(true);
    const res = await api.post(`/api/companies/${companyId}/members`, { phone: invitePhone.trim(), role: inviteRole });
    setInviting(false);
    if (!res.ok) {
      toast('error', res.error?.message || '邀请失败');
      return;
    }
    toast('success', '邀请已发送');
    setInviteOpen(false);
    reload();
  };

  const changeRole = async (m: MemberItem, role: string) => {
    if (!companyId) return;
    const res = await api.put(`/api/companies/${companyId}/members/${m.user_id}`, { role });
    if (!res.ok) {
      toast('error', res.error?.message || '调整角色失败');
      return;
    }
    toast('success', '角色已调整');
    reload();
  };

  const remove = async () => {
    if (!removing || !companyId) return;
    setRemovingLoading(true);
    const res = await api.del(`/api/companies/${companyId}/members/${removing.user_id}`);
    setRemovingLoading(false);
    if (!res.ok) {
      toast('error', res.error?.message || '移除失败');
      setRemoving(null);
      return;
    }
    toast('success', '成员已移除');
    setRemoving(null);
    reload();
  };

  const canManage = (m: MemberItem) => isOwner && m.user_id !== currentUserId && m.role !== 'OWNER';

  return (
    <CompanyShell>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-text">成员管理（{members.length}）</h1>
        {isOwner && <Button size="sm" onClick={openInvite}>邀请成员</Button>}
      </div>

      {!isOwner && (
        <div className="mb-4 rounded-lg border border-border bg-bg-subtle px-4 py-3 text-sm text-text-secondary">
          仅企业「所有者」可以邀请成员、调整角色或移除成员。
        </div>
      )}

      {dataLoading ? (
        <PageLoading />
      ) : members.length === 0 ? (
        <Empty title="暂无成员" description="邀请团队成员共同管理企业职位与消息" />
      ) : (
        <div className="flex flex-col gap-3">
          {members.map((m) => {
            const isSelf = m.user_id === currentUserId;
            return (
              <Card key={m.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  {m.user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.user.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-text">
                      {m.user.name.slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-text">
                        {m.user.name}
                        {isSelf && <span className="ml-1 text-xs text-text-secondary">（我）</span>}
                      </span>
                      <Badge tone={m.role === 'OWNER' ? 'primary' : m.role === 'HR' ? 'success' : 'default'}>
                        {COMPANY_ROLE_LABEL[m.role] || m.role}
                      </Badge>
                      {m.status !== 'ACTIVE' && (
                        <Badge tone={m.status === 'INVITED' ? 'warning' : 'neutral'}>
                          {MEMBER_STATUS_LABEL[m.status] || m.status}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-text-secondary">{m.user.phone || '-'}</p>
                  </div>
                  {canManage(m) && (
                    <div className="flex items-center gap-2">
                      <Select value={m.role} onChange={(e) => changeRole(m, e.target.value)} className="!w-auto">
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                      <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>移除</Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 邀请弹窗 */}
      <Modal
        open={inviteOpen}
        title="邀请成员"
        onClose={() => setInviteOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviteOpen(false)} disabled={inviting}>取消</Button>
            <Button onClick={invite} loading={inviting}>发送邀请</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="手机号" placeholder="输入已注册账号的手机号" value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} />
          <Select label="角色" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
            <option value="HR">管理员（可发布/编辑职位）</option>
            <option value="VIEWER">查看者（仅可查看）</option>
          </Select>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!removing}
        title="移除成员"
        message={`确定将「${removing?.user.name || ''}」移出企业吗？`}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
        confirmText="移除"
        loading={removingLoading}
      />
    </CompanyShell>
  );
}
