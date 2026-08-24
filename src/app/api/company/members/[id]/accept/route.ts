import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { verifyCode } from '@/lib/sms';
import { notifyUser } from '@/lib/notification';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** 受邀者凭短信码接受邀请：[id] 为 company_members.id。仅被邀请人本人可操作 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!/^\d{6}$/.test(code)) return fail('VALIDATION_ERROR', '验证码格式不正确');

  const member = await prisma.companyMember.findUnique({
    where: { id },
    include: { company: { select: { id: true, name: true, owner_id: true } }, user: { select: { id: true, phone: true, status: true } } },
  });
  if (!member) return fail('MEMBER_NOT_FOUND', '邀请不存在', 404);
  if (member.status !== 'INVITED') return fail('MEMBER_NOT_INVITED', '该邀请已失效');
  if (member.user_id !== user.id) return fail('FORBIDDEN', '只能接受发给自己的邀请');
  if (member.user.status === 'DELETED' || member.user.status === 'BANNED') return fail('FORBIDDEN', '账号状态异常，无法接受邀请');
  if (!member.user.phone) return fail('FORBIDDEN', '当前账号无手机号，无法验证');

  // 短信码校验（一次性，防爆破）
  const okFlag = await verifyCode(member.user.phone, code, 'VERIFY');
  if (!okFlag) return fail('INVALID_CODE', '验证码错误或已过期');

  const updated = await prisma.companyMember.update({
    where: { id: member.id },
    data: { status: 'ACTIVE', role: member.role === 'OWNER' ? 'HR' : member.role },
  });

  await notifyUser({
    userId: member.company.owner_id,
    type: 'SYSTEM',
    title: '新成员已加入',
    body: `${user.name} 已接受邀请加入「${member.company.name}」`,
    link: '/company/members',
  });
  log('info', 'member:invite-accepted', { companyId: member.company_id, userId: user.id, memberId: member.id });
  return ok(updated);
}
