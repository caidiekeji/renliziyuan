import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 我加入的企业列表（含角色、订阅状态） */
export async function GET() {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const members = await prisma.companyMember.findMany({
    where: { user_id: user.id, status: { in: ['ACTIVE', 'INVITED'] } },
    include: {
      company: {
        select: {
          id: true, name: true, logo: true, verify_status: true, avg_rating: true, review_count: true,
          industry: { select: { id: true, name: true } },
        },
      },
    },
  });
  const companyIds = members.map((m) => m.company_id);
  const subs = await prisma.subscription.findMany({
    where: { company_id: { in: companyIds }, status: 'ACTIVE' },
    include: { plan: { select: { id: true, name: true, job_limit: true, can_feature: true, can_view_contacts: true } } },
  });
  const openJobCounts = await prisma.job.groupBy({
    by: ['company_id'],
    where: { company_id: { in: companyIds }, status: 'OPEN', deleted_at: null },
    _count: { _all: true },
  });
  const countMap = new Map(openJobCounts.map((r) => [r.company_id, r._count._all]));
  return ok(
    members.map((m) => ({
      company: m.company,
      role: m.role,
      status: m.status,
      subscription: subs.find((s) => s.company_id === m.company_id) || null,
      open_job_count: countMap.get(m.company_id) || 0,
    }))
  );
}
