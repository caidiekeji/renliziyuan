import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { invalidateCache } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** 管理员获取评价算法配置 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    let cfg = await prisma.ratingConfig.findFirst();
    if (!cfg) {
      cfg = await prisma.ratingConfig.create({ data: {} });
    }
    return ok(cfg);
  } catch (e) {
    return handleError(e);
  }
}

/** 管理员更新评价算法配置 */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const body = await req.json();
    const data: Record<string, number> = {};
    const fields = [
      'decay_tier1_months', 'decay_tier1_weight', 'decay_tier2_months', 'decay_tier2_weight', 'decay_tier3_weight',
      'low_rating_threshold', 'penalty_factor', 'min_reviews_for_real', 'fallback_rating', 'w_rating',
    ];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = Number(body[f]);
    }
    // 基本范围校验，防止非法配置破坏算法
    if (data.penalty_factor !== undefined && (data.penalty_factor < 0 || data.penalty_factor > 1))
      return fail('INVALID_VALUE', '降权系数 penalty_factor 需在 0~1 之间', 400);
    if (data.low_rating_threshold !== undefined && (data.low_rating_threshold < 1 || data.low_rating_threshold > 5))
      return fail('INVALID_VALUE', '降权评分阈值需在 1~5 之间', 400);
    if (data.fallback_rating !== undefined && (data.fallback_rating < 1 || data.fallback_rating > 5))
      return fail('INVALID_VALUE', '默认评分需在 1~5 之间', 400);
    if (data.w_rating !== undefined && (data.w_rating < 0 || data.w_rating > 1))
      return fail('INVALID_VALUE', '推荐评分权重需在 0~1 之间', 400);
    const existing = await prisma.ratingConfig.findFirst();
    const cfg = existing
      ? await prisma.ratingConfig.update({ where: { id: existing.id }, data: data as any })
      : await prisma.ratingConfig.create({ data: data as any });
    invalidateCache(['rating_config']);
    return ok(cfg);
  } catch (e) {
    return handleError(e);
  }
}
