import { NextRequest } from 'next/server';
import { ok, fail, created, handleError } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { jobPublishSchema } from '@/lib/validators/zod';
import { sensitiveWordFilter } from '@/lib/sensitive/filter';
import { getSiteConfig } from '@/lib/config';
import { getCityBoostJobs } from '@/lib/boost';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** 职位公开列表/搜索 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const keyword = url.searchParams.get('keyword')?.trim();
  const city = url.searchParams.get('city');
  const industryId = url.searchParams.get('industry_id');
  const jobTitleId = url.searchParams.get('job_title_id');
  const jobType = url.searchParams.get('job_type');
  const experience = url.searchParams.get('experience');
  const salaryMin = url.searchParams.get('salary_min');
  const sort = url.searchParams.get('sort') || 'latest'; // latest | salary_desc | salary_asc | hot
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

  const where: any = { status: 'OPEN', audit_status: 'APPROVED', deleted_at: null };
  if (city && city !== '全国') where.city = city;
  if (industryId) where.industry_id = industryId;
  if (jobTitleId) where.job_title_id = jobTitleId;
  if (jobType) where.job_type = jobType;
  if (experience) where.experience = experience;
  if (salaryMin) where.salary_max = { gte: Number(salaryMin) };
  const isHourly = url.searchParams.get('is_hourly');
  if (isHourly === 'true') where.is_hourly = true;
  if (isHourly === 'false') where.is_hourly = false;
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: 'insensitive' } },
      { description: { contains: keyword, mode: 'insensitive' } },
      { tags: { has: keyword } },
    ];
  }

  // 置顶区域（v2.1）：顶部"置顶职位"，全局按出价 Top3；自然排名剔除置顶职位避免重复（v2.2）
  let boosts: any[] = [];
  if (isHourly !== 'true') {
    boosts = await getCityBoostJobs(city && city !== '全国' ? city : undefined, jobType || undefined);
    if (boosts.length) {
      const boostIds = boosts.map((b) => b.id);
      where.AND = [...(where.AND || []), { id: { notIn: boostIds } }];
    }
  }

  const orderBy: any =
    sort === 'salary_desc'
      ? [{ salary_max: 'desc' as const }, { salary_min: 'desc' as const }]
      : sort === 'salary_asc'
        ? [{ salary_max: 'asc' as const }]
        : sort === 'hot'
          ? [{ views: 'desc' as const }]
          : [{ created_at: 'desc' as const }];

  const [total, items] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        company: { select: { id: true, name: true, logo: true, verify_status: true, avg_rating: true } },
        industry: { select: { id: true, name: true } },
        job_title: { select: { id: true, name: true, category: true } },
      },
    }),
  ]);

  return ok(items, { total, page, pageSize, boosts });
}

/** 企业发布职位（成员身份 + 套餐配额校验） */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const parsed = jobPublishSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');

  // 企业上下文：x-company-id 头
  const companyId = req.headers.get('x-company-id');
  if (!companyId) return fail('INVALID_CONTEXT', '缺少企业上下文', 400);
  const { member, error } = await requireCompanyMember(user, companyId, 'HR');
  if (!member) return error!;

  const hit = await sensitiveWordFilter('JOB', `${parsed.data.title} ${parsed.data.description}`);
  if (hit) return fail('SENSITIVE_WORD', `内容包含敏感词「${hit}」`);

  // 前置审计：PRS 模式需审核通过后才上线
  const cfg = await getSiteConfig();
  const autoApprove = cfg.audit_mode === 'POST';

  // 套餐配额校验
  const sub = await prisma.subscription.findFirst({
    where: { company_id: companyId, status: 'ACTIVE', end_at: { gt: new Date() } },
    include: { plan: true },
  });
  const canFeature = !!sub?.plan.can_feature;
  if (parsed.data.is_featured && !canFeature) return fail('FEATURE_NOT_ALLOWED', '当前套餐不支持置顶');

  if (sub && sub.plan.job_limit !== 999999) {
    const openCount = await prisma.job.count({ where: { company_id: companyId, status: 'OPEN', deleted_at: null } });
    if (openCount >= sub.plan.job_limit) {
      return fail('JOB_LIMIT_EXCEEDED', `套餐职位上限 ${sub.plan.job_limit} 个，请升级套餐`, 403);
    }
  } else if (!sub) {
    // 无订阅：按免费版 3 个限额
    const openCount = await prisma.job.count({ where: { company_id: companyId, status: 'OPEN', deleted_at: null } });
    if (openCount >= 3) return fail('JOB_LIMIT_EXCEEDED', '免费版最多发布 3 个职位，请升级套餐', 403);
  }

  try {
    const job = await prisma.job.create({
      data: {
        ...parsed.data,
        company_id: companyId,
        is_featured: parsed.data.is_featured && canFeature ? true : false,
        audit_status: autoApprove ? 'APPROVED' : 'PENDING',
        status: autoApprove ? 'OPEN' : 'CLOSED',
        closed_reason: autoApprove ? null : 'AUDIT_REJECTED',
      },
    });
    if (!autoApprove) log('info', 'job:pending-audit', { jobId: job.id, companyId });
    return created(job);
  } catch (e) {
    return handleError(e);
  }
}
