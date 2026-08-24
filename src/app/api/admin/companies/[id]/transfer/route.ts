import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';
import { notifyUser } from '@/lib/notification';

export const dynamic = 'force-dynamic';

/** 指定新 OWNER（当原 OWNER 被注销且无 HR 时接管企业）：指定任意有效用户为企业 OWNER */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const targetId = typeof body?.user_id === 'string' ? body.user_id : '';
  if (!targetId) return fail('VALIDATION_ERROR', '缺少 user_id');

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) return fail('COMPANY_NOT_FOUND', '企业不存在', 404);

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target || target.status !== 'ACTIVE') return fail('USER_NOT_FOUND', '目标用户不存在或已停用');

  const newOwner = await prisma.$transaction(async (tx) => {
    // 原 OWNER 降为 HR（保留成员身份）
    if (company.owner_id !== targetId) {
      await tx.companyMember.upsert({
        where: { company_id_user_id: { company_id: id, user_id: company.owner_id } },
        update: { role: 'HR', status: 'ACTIVE' },
        create: { company_id: id, user_id: company.owner_id, role: 'HR', status: 'ACTIVE' },
      });
    }
    // 目标用户加入企业并设为 OWNER（已存在则升级）
    const member = await tx.companyMember.upsert({
      where: { company_id_user_id: { company_id: id, user_id: targetId } },
      update: { role: 'OWNER', status: 'ACTIVE' },
      create: { company_id: id, user_id: targetId, role: 'OWNER', status: 'ACTIVE' },
    });
    const updated = await tx.company.update({
      where: { id },
      data: { owner_id: targetId, contact_phone: target.phone ?? company.contact_phone },
    });
    return { member, updated };
  });

  await notifyUser({
    userId: targetId,
    type: 'COMPANY_VERIFY',
    title: '你已成为企业管理员',
    body: `你已被指定为「${company.name}」的负责人（OWNER）`,
    link: '/company/members',
  });
  await auditLog({
    adminId: auth.admin.id,
    action: 'TRANSFER_COMPANY_OWNER',
    targetType: 'COMPANY',
    targetId: id,
    detail: { from: company.owner_id, to: targetId },
    ip: getClientIp(req),
  });
  return ok({ owner_id: newOwner.updated.owner_id, member_id: newOwner.member.id });
}
