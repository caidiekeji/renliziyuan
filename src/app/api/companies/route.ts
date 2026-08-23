import { NextRequest } from 'next/server';
import { fail, created, handleError } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { companyCreateSchema } from '@/lib/validators/zod';
import { sensitiveWordFilter } from '@/lib/sensitive/filter';

export const dynamic = 'force-dynamic';

/** 创建企业（创建者成为 OWNER） */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const parsed = companyCreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  const hit = await sensitiveWordFilter('JOB', `${parsed.data.name} ${parsed.data.description || ''}`);
  if (hit) return fail('SENSITIVE_WORD', `内容包含敏感词「${hit}」`);
  try {
    const company = await prisma.$transaction(async (tx) => {
      const c = await tx.company.create({ data: { owner_id: user.id, ...parsed.data } });
      await tx.companyMember.create({ data: { company_id: c.id, user_id: user.id, role: 'OWNER', status: 'ACTIVE' } });
      return c;
    });
    return created(company);
  } catch (e) {
    return handleError(e);
  }
}
