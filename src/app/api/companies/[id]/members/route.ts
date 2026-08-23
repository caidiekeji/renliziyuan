import { NextRequest } from 'next/server';
import { ok, fail, created, handleError } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 企业成员列表（OWNER/HR 可见） */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const { member, error } = await requireCompanyMember(user, id, 'HR');
  if (!member) return error!;
  const members = await prisma.companyMember.findMany({
    where: { company_id: id },
    include: { user: { select: { id: true, name: true, avatar: true, phone: true } } },
    orderBy: { created_at: 'asc' },
  });
  return ok(members);
}

/** 邀请成员（OWNER） */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const { member, error } = await requireCompanyMember(user, id, 'OWNER');
  if (!member) return error!;
  const { phone, role } = await req.json().catch(() => ({}));
  if (!phone || !['OWNER', 'HR', 'VIEWER'].includes(role)) return fail('VALIDATION_ERROR', '参数错误');
  const target = await prisma.user.findUnique({ where: { phone } });
  if (!target) return fail('USER_NOT_FOUND', '该手机号未注册');
  try {
    const m = await prisma.companyMember.upsert({
      where: { company_id_user_id: { company_id: id, user_id: target.id } },
      update: { role, status: 'INVITED' },
      create: { company_id: id, user_id: target.id, role, status: 'INVITED' },
    });
    return created(m);
  } catch (e) {
    return handleError(e);
  }
}
