import { createWorker } from '../index';
import { prisma } from '@/lib/db/prisma';

/** 企业平均评分重算（加权：近 3 个月 1.0，3-12 个月 0.5，>12 个月 0.25） */
export function startRecalcRatingWorker() {
  return createWorker('recalc-rating', async ({ companyId }: { companyId: string }) => {
    const reviews = await prisma.review.findMany({
      where: { company_id: companyId, deleted_at: null },
      select: { rating: true, created_at: true },
    });
    if (reviews.length === 0) {
      await prisma.company.update({ where: { id: companyId }, data: { avg_rating: 0, review_count: 0 } });
      return;
    }
    const now = Date.now();
    let total = 0;
    let sum = 0;
    for (const r of reviews) {
      const age = (now - r.created_at.getTime()) / (1000 * 3600 * 24 * 30);
      const w = age <= 3 ? 1 : age <= 12 ? 0.5 : 0.25;
      total += w;
      sum += r.rating * w;
    }
    const avg = Number((sum / total).toFixed(1));
    await prisma.company.update({
      where: { id: companyId },
      data: { avg_rating: avg, review_count: reviews.length },
    });
  });
}
