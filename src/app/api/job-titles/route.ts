import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 职位名称（公开，支持关键词/分类过滤） */
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category');
  const sub = req.nextUrl.searchParams.get('sub_category');
  const keyword = req.nextUrl.searchParams.get('keyword');
  const where: any = { active: true };
  if (category) where.category = category;
  if (sub) where.sub_category = sub;
  if (keyword) where.name = { contains: keyword, mode: 'insensitive' };
  const titles = await prisma.jobTitle.findMany({ where, orderBy: [{ category: 'asc' }, { sort: 'desc' }], take: 300 });
  return ok(titles);
}
