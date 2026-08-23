import { NextRequest } from 'next/server';
import { fail, created } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { maskPhone } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * 一键电话（拨号意向记录）
 * - 求职者 → 企业职位：返回企业联系电话（验证企业可见）
 * - 企业成员 → 求职信息：需套餐 can_view_contacts 才可看到完整手机号
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { type, target_id } = await req.json().catch(() => ({}));
  if (!type || !target_id) return fail('VALIDATION_ERROR', '参数缺失');

  if (type === 'JOB') {
    const job = await prisma.job.findFirst({ where: { id: target_id, deleted_at: null, status: 'OPEN' } });
    if (!job) return fail('JOB_NOT_FOUND', '职位不存在', 404);
    const company = await prisma.company.findUnique({ where: { id: job.company_id } });
    if (!company?.contact_phone) return fail('NO_CONTACT', '该企业未公开联系电话');
    await prisma.callLog.create({ data: { caller_id: user.id, callee_id: company.owner_id, related_type: 'JOB', related_id: job.id } });
    return created({ callee_phone: company.contact_phone, masked: false });
  }

  if (type === 'SEEKER_POST') {
    const post = await prisma.seekerPost.findFirst({ where: { id: target_id, status: 'OPEN' } });
    if (!post) return fail('NOT_FOUND', '求职信息不存在', 404);
    // 企业成员身份校验
    const member = await prisma.companyMember.findFirst({ where: { user_id: user.id, status: 'ACTIVE' } });
    const subscription = member
      ? await prisma.subscription.findFirst({ where: { company_id: member.company_id, status: 'ACTIVE', end_at: { gt: new Date() } } })
      : null;
    const plan = subscription ? await prisma.plan.findUnique({ where: { id: subscription.plan_id } }) : null;
    const canView = !!plan?.can_view_contacts;
    const callee = await prisma.user.findUnique({ where: { id: post.user_id } });
    if (!callee?.phone) return fail('NO_CONTACT', '求职者未公开手机号');
    await prisma.callLog.create({ data: { caller_id: user.id, callee_id: post.user_id, related_type: 'SEEKER_POST', related_id: post.id } });
    return created({ callee_phone: canView ? callee.phone : maskPhone(callee.phone), masked: !canView });
  }

  return fail('INVALID_TYPE', '不支持的拨号类型');
}
