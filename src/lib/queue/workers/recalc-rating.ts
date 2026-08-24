import { createWorker } from '../index';
import { prisma } from '@/lib/db/prisma';
import { getRatingConfig } from '@/lib/config';

/** 企业平均评分重算（加权：近 N 个月高权重，超期递减） */
export function startRecalcRatingWorker() {
  return createWorker('recalc-rating', async ({ companyId }: { companyId: string }) => {
    const cfg = await getRatingConfig();
    const reviews = await prisma.review.findMany({
      where: { company_id: companyId, deleted_at: null },
      select: { rating: true, created_at: true },
    });
    if (reviews.length === 0) {
      // 无评价时保持默认5星，不重置为0
      return;
    }
    const now = Date.now();
    let total = 0;
    let sum = 0;
    for (const r of reviews) {
      const age = (now - r.created_at.getTime()) / (1000 * 3600 * 24 * 30); // 月数
      const w = age <= cfg.decay_tier1_months
        ? cfg.decay_tier1_weight
        : age <= cfg.decay_tier2_months
          ? cfg.decay_tier2_weight
          : cfg.decay_tier3_weight;
      total += w;
      sum += r.rating * w;
    }
    // 评价数不足时使用加权评分与默认评分的混合
    let avg = total > 0 ? Number((sum / total).toFixed(1)) : 0;
    if (reviews.length < cfg.min_reviews_for_real) {
      avg = Number(((avg * reviews.length + cfg.fallback_rating * (cfg.min_reviews_for_real - reviews.length)) / cfg.min_reviews_for_real).toFixed(1));
    }
    await prisma.company.update({
      where: { id: companyId },
      data: { avg_rating: avg, review_count: reviews.length },
    });
  });
}
