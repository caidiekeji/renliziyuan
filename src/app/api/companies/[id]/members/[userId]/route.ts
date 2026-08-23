import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { auditLog } from '@/lib/auth/admin';
import { log } from '@/lib/logger';
import { kickUser } from '@/lib/socket/server';

export const dynamic = 'force-dynamic';

/** 更新成员角色（OWNER）。状态变更须走 DELETE 移除接口（含主联系人转移逻辑），防绕过 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id, userId } = await params;
  const { member, error } = await requireCompanyMember(user, id, 'OWNER');
  if (!member) return error!;
  if (userId === member.user_id) return fail('FORBIDDEN', '不能修改自己的角色');
  const body = await req.json().catch(() => ({}));
  const role = body?.role;
  if (body?.status !== undefined) return fail('VALIDATION_ERROR', '成员状态变更请使用移除成员操作');
  if (role !== undefined && !['OWNER', 'HR', 'VIEWER'].includes(role))
    return fail('VALIDATION_ERROR', '角色必须为 OWNER/HR/VIEWER');
  try {
    const updated = await prisma.companyMember.update({
      where: { company_id_user_id: { company_id: id, user_id: userId } },
      data: { role: role || undefined },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}

/** 移除成员（OWNER）：若移除的是主联系人，标志自动转移给最近活跃成员（v1.9.3-P2④/v2.6） */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id, userId } = await params;
  const { member, error } = await requireCompanyMember(user, id, 'OWNER');
  if (!member) return error!;
  if (userId === member.user_id) return fail('FORBIDDEN', '不能移除自己');

  try {
    const removed = await prisma.companyMember.findUnique({
      where: { company_id_user_id: { company_id: id, user_id: userId } },
    });
    if (!removed) return fail('MEMBER_NOT_FOUND', '成员不存在', 404);

    await prisma.companyMember.update({
      where: { company_id_user_id: { company_id: id, user_id: userId } },
      data: { status: 'REMOVED' },
    });

    // 成员被移除：实时踢下线，使其企业上下文失效
    kickUser(userId, '已被移出企业');

    // 移除的是主联系人：转移标志 / 清空 contact_phone + 审计
    if (removed.is_primary_contact) {
      const next = await prisma.companyMember.findFirst({
        where: { company_id: id, status: 'ACTIVE', user_id: { not: userId } },
        orderBy: { user: { last_login_at: { sort: 'desc', nulls: 'last' } } },
        include: { user: { select: { id: true, phone: true, last_login_at: true } } },
      });
      if (next?.user.phone) {
        await prisma.companyMember.update({ where: { id: next.id }, data: { is_primary_contact: true } });
        await prisma.company.update({ where: { id }, data: { contact_phone: next.user.phone } });
        await auditLog({
          adminId: user.id,
          action: 'PRIMARY_CONTACT_TRANSFER',
          targetType: 'COMPANY',
          targetId: id,
          detail: { from: userId, to: next.user_id, contact_phone: next.user.phone },
        });
        log('info', 'member:primary-contact-transferred', { companyId: id, from: userId, to: next.user_id });
      } else {
        await prisma.company.update({ where: { id }, data: { contact_phone: null } });
        await auditLog({
          adminId: user.id,
          action: 'PRIMARY_CONTACT_CLEARED',
          targetType: 'COMPANY',
          targetId: id,
          detail: { from: userId, reason: '无其他活跃成员' },
        });
        log('info', 'member:primary-contact-cleared', { companyId: id, from: userId });
      }
    }
    return ok({ success: true });
  } catch (e) {
    return handleError(e);
  }
}
