import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { scoreJob, getUserEventScores } from '@/lib/recommend/score';
import { getCityBoostJobs } from '@/lib/boost';

export const dynamic = 'force-dynamic';

/**
 * 个性化推荐职位
 * 数据源：职位匹配（技能/类型/城市/行为/热度）加权得分排序
 * 强制曝光/人工加权职位置顶
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);

  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));

  // 置顶区域：城市维度的 Top3 竞价置顶职位置于推荐顶部（v2.1/v2.2）
  const boostJobs = await getCityBoostJobs(user.city || undefined, undefined);
  const boostIds = new Set(boostJobs.map((j) => j.id));

  const [jobs, userEvents, boosts, blacklist] = await Promise.all([
    prisma.job.findMany({
      where: { status: 'OPEN', audit_status: 'APPROVED', deleted_at: null, id: { notIn: [...boostIds] } },
      take: 500,
      include: { company: { select: { id: true, name: true, logo: true } } },
    }),
    getUserEventScores(user.id),
    prisma.jobBoost.findMany({ select: { job_id: true, boost: true, forced: true } }),
    prisma.recommendationBlacklist.findMany({ select: { job_id: true } }),
  ]);

  const boostMap = new Map(boosts.map((b) => [b.job_id, b]));
  const blackSet = new Set(blacklist.map((b) => b.job_id));
  const features = {
    skills: user.skills || [],
    city: user.city || null,
    expectedCity: user.city || null,
    jobType: null,
  };

  const scored = jobs
    .filter((j) => !blackSet.has(j.id))
    .map(async (j) => {
      const score = await scoreJob(j as any, features, userEvents);
      const boost = boostMap.get(j.id);
      return { job: j, score: score + (boost ? Number(boost.boost) * 10 : 0), forced: !!boost?.forced };
    });

  const results = (await Promise.all(scored)).sort((a, b) => {
    if (a.forced !== b.forced) return a.forced ? -1 : 1;
    return b.score - a.score;
  });

  // 置顶职位置于推荐流最前（每页展示），标记 bid
  const all = [...boostJobs.map((j) => ({ job: j, score: Number.MAX_SAFE_INTEGER })), ...results];
  const total = all.length;
  const items = all.slice((page - 1) * pageSize, page * pageSize).map((r) => r.job);
  return ok(items, { total, page, pageSize, boosts: boostJobs });
}
