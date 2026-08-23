import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { companyUpdateSchema } from '@/lib/validators/zod';
import { sensitiveWordFilter } from '@/lib/sensitive/filter';
import { verifyCode } from '@/lib/sms';
import { auditLog } from '@/lib/auth/admin';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** 企业主页（公开：企业信息 + 行业 + 在招职位 + 评价聚合） */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await prisma.company.findFirst({
    where: { id },
    include: {
      industry: { select: { id: true, name: true } },
    },
  });
  if (!company) return fail('COMPANY_NOT_FOUND', '企业不存在', 404);
  const [jobs, reviewAgg] = await Promise.all([
    prisma.job.findMany({
      where: { company_id: id, status: 'OPEN', audit_status: 'APPROVED', deleted_at: null },
      orderBy: { created_at: 'desc' },
      take: 20,
      include: { industry: { select: { id: true, name: true } }, job_title: { select: { id: true, name: true } } },
    }),
    prisma.review.aggregate({
      where: { company_id: id, deleted_at: null },
      _avg: { rating: true },
      _count: true,
    }),
  ]);
  return ok({ ...company, avg_rating: reviewAgg._avg.rating ?? company.avg_rating, review_count: reviewAgg._count, jobs });
}

/** 更新企业资料（OWNER/HR）。修改联系手机号需短信验证码验证（v1.9.3-P2④）+ 响应禁止缓存 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const { member, error } = await requireCompanyMember(user, id, 'HR');
  if (!member) return error!;

  const body = await req.json().catch(() => ({}));
  const parsed = companyUpdateSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  if (parsed.data.name || parsed.data.description) {
    const hit = await sensitiveWordFilter('JOB', `${parsed.data.name || ''} ${parsed.data.description || ''}`);
    if (hit) return fail('SENSITIVE_WORD', `内容包含敏感词「${hit}」`);
  }

  // 联系手机号变更：短信验证码归属权校验（防止乱填他人号码）
  if (parsed.data.contact_phone !== undefined && parsed.data.contact_phone !== null) {
    const smsCode = String(body.sms_code || '').trim();
    if (!smsCode) return fail('SMS_CODE_REQUIRED', '修改联系手机号需短信验证码验证');
    const verified = await verifyCode(parsed.data.contact_phone, smsCode, 'VERIFY');
    if (!verified) return fail('SMS_CODE_INVALID', '验证码错误或已过期');
  }

  try {
    const updated = await prisma.company.update({ where: { id }, data: parsed.data });

    // is_primary_contact 联动：联系手机持有人标记为唯一主联系人（v1.9.3/v2.6）
    if (parsed.data.contact_phone !== undefined && parsed.data.contact_phone !== null) {
      await prisma.companyMember.updateMany({
        where: { company_id: id, status: 'ACTIVE', is_primary_contact: true },
        data: { is_primary_contact: false },
      });
      const primary = await prisma.companyMember.findFirst({
        where: { company_id: id, status: 'ACTIVE', user: { phone: parsed.data.contact_phone } },
      });
      if (primary) {
        await prisma.companyMember.update({ where: { id: primary.id }, data: { is_primary_contact: true } });
      }
      await auditLog({
        adminId: user.id,
        action: 'UPDATE_CONTACT_PHONE',
        targetType: 'COMPANY',
        targetId: id,
        detail: { contact_phone: parsed.data.contact_phone, primary_member_id: primary?.id || null },
      });
      log('info', 'company:contact-phone-updated', { companyId: id, primaryMemberId: primary?.id || null });
    }

    const res = ok(updated);
    res.headers.set('Cache-Control', 'no-cache');
    return res;
  } catch (e) {
    return handleError(e);
  }
}
