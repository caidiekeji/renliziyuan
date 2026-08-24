import { prisma } from '@/lib/db/prisma';
import { getRecommendationConfig, getRatingConfig } from '@/lib/config';
import { haversineKm } from '@/lib/geo';

interface JobRow {
  id: string;
  title: string;
  city: string;
  job_type: string;
  tags: string[];
  views: number;
  created_at: Date;
  lat?: number | null;
  lng?: number | null;
  company?: { avg_rating?: number | null; review_count?: number | null };
}

export interface UserFeatures {
  skills: string[];
  city: string | null; // 当前城市（定位）
  expectedCity?: string | null; // 期望工作城市
  jobType?: string | null;
}

/**
 * 推荐打分引擎（规则权重型）
 * score = w_skill*skill_match + w_type*type_match + w_city_located*city_match(located)
 *       + w_city_expected*city_match(expected) + w_behavior*behavior + w_hot*hot_score
 * 热力分：views 指数衰减 + 新鲜度半衰期
 */
export async function scoreJob(job: JobRow, user: UserFeatures, userEvents: Map<string, number>): Promise<number> {
  const [cfg, rc] = await Promise.all([getRecommendationConfig(), getRatingConfig()]);
  const w = {
    skill: Number(cfg.w_skill),
    type: Number(cfg.w_type),
    cityLocated: cfg.located_city_enabled ? Number(cfg.w_city_located) : 0,
    cityExpected: Number(cfg.w_city_expected),
    behavior: Number(cfg.w_behavior),
    hot: Number(cfg.w_hot),
  };

  let score = 0;

  // 技能匹配：命中技能数 / 用户技能数（分母为 0 则取职位技能数）
  const skillHits = job.tags.filter((t) => user.skills.includes(t)).length;
  if (skillHits > 0) score += w.skill * (skillHits / Math.max(user.skills.length, 1));

  // 职位类型匹配
  if (user.jobType && job.job_type === user.jobType) score += w.type;

  // 城市匹配
  if (user.city && job.city === user.city) score += w.cityLocated;
  if (user.expectedCity && job.city === user.expectedCity) score += w.cityExpected;

  // 行为分（近 90 天）
  const behavior = userEvents.get(job.id) ?? 0;
  if (behavior > 0) score += w.behavior * behavior;

  // 热力分：浏览量 log 缩放 + 新鲜度半衰期
  const hot = Math.log(1 + job.views) * w.hot;
  const ageDays = (Date.now() - job.created_at.getTime()) / (24 * 3600 * 1000);
  const freshness = Math.pow(0.5, ageDays / cfg.freshness_halflife_days);
  score += hot * freshness;

  // 评分因子：企业 avg_rating 映射到 0~1 加权；低评分企业按降权系数衰减（越小越靠后）
  if (job.company?.avg_rating && rc.w_rating > 0) {
    let ratingNorm = Math.max(0, Math.min(1, (Number(job.company.avg_rating) - 1) / 4)); // 1~5 映射到 0~1
    if (rc.penalty_factor < 1 && Number(job.company.avg_rating) < rc.low_rating_threshold) {
      ratingNorm *= rc.penalty_factor;
    }
    score += rc.w_rating * ratingNorm;
  }

  return score;
}

/** 拉取用户近 90 天行为（jobId -> 加权分） */
export async function getUserEventScores(userId: string): Promise<Map<string, number>> {
  const events = await prisma.userEvent.findMany({
    where: { user_id: userId, created_at: { gte: new Date(Date.now() - 90 * 24 * 3600 * 1000) } },
    select: { job_id: true, weight: true },
  });
  const map = new Map<string, number>();
  for (const e of events) map.set(e.job_id, (map.get(e.job_id) ?? 0) + e.weight);
  return map;
}

/** 附近职位过滤（可选）：以 city 中心坐标 + 半径（km）过滤 */
export function withinRadius(job: JobRow, lat: number, lng: number, radiusKm: number): boolean {
  if (job.lat == null || job.lng == null) return false;
  return haversineKm(lat, lng, Number(job.lat), Number(job.lng)) <= radiusKm;
}
