import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 城市列表（公开，含坐标） */
export async function GET(req: NextRequest) {
  const province = req.nextUrl.searchParams.get('province');
  const where = province ? { province } : {};
  const cities = await prisma.city.findMany({ where, orderBy: [{ province: 'asc' }, { name: 'asc' }] });
  return ok(cities);
}
