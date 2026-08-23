import { NextRequest } from 'next/server';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { recommendationConfigSchema } from '@/lib/validators/zod';
import { invalidateCache } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** 推荐权重配置 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const cfg = await prisma.recommendationConfig.findUnique({ where: { id: 1 } });
  return ok(cfg);
}

/** 更新推荐权重配置（更新后失效缓存） */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = recommendationConfigSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const cfg = await prisma.recommendationConfig.update({ where: { id: 1 }, data: parsed.data });
    invalidateCache();
    await auditLog({ adminId: auth.admin.id, action: 'UPDATE_RECOMMENDATION_CONFIG', targetType: 'RECOMMENDATION_CONFIG', targetId: '1', detail: parsed.data, ip: getClientIp(req) });
    return ok(cfg);
  } catch (e) {
    return handleError(e);
  }
}
