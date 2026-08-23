import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 站点地图：静态页 + 公开在招职位详情页 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const urls: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/jobs`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/hourly-jobs`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/seekers`, changeFrequency: 'daily', priority: 0.8 },
  ];

  try {
    const jobs = await prisma.job.findMany({
      where: { status: 'OPEN', deleted_at: null },
      select: { id: true, updated_at: true },
      orderBy: { updated_at: 'desc' },
      take: 5000,
    });
    for (const j of jobs) {
      urls.push({
        url: `${base}/jobs/${j.id}`,
        lastModified: j.updated_at,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
  } catch {
    // 数据库不可用时仍输出基础站点地图，避免构建失败
  }

  return urls;
}