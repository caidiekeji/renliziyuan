import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { siteConfigSchema } from '@/lib/validators/zod';
import { invalidateCache } from '@/lib/config';

export const dynamic = 'force-dynamic';

const seoConfigSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  keywords: z.string().max(300).optional(),
  sitemap_enabled: z.boolean().optional(),
});

/** 站点配置 + SEO 配置 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const site = await prisma.siteConfig.findUnique({ where: { id: 1 } });
  const seo = await prisma.seoConfig.findUnique({ where: { id: 1 } });
  return ok({ site, seo });
}

/** 更新站点配置 / SEO 配置（部分字段） */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const siteParsed = siteConfigSchema.partial().safeParse(body.site ?? {});
  if (!siteParsed.success) return fail('VALIDATION_ERROR', siteParsed.error.issues[0]?.message || '参数错误');
  const seoParsed = seoConfigSchema.safeParse(body.seo ?? {});
  if (!seoParsed.success) return fail('VALIDATION_ERROR', seoParsed.error.issues[0]?.message || '参数错误');
  if (Object.keys(siteParsed.data).length === 0 && Object.keys(seoParsed.data).length === 0) {
    return fail('NO_FIELDS', '没有需要更新的配置');
  }
  try {
    const result: any = {};
    if (Object.keys(siteParsed.data).length > 0) {
      result.site = await prisma.siteConfig.update({ where: { id: 1 }, data: siteParsed.data });
    }
    if (Object.keys(seoParsed.data).length > 0) {
      result.seo = await prisma.seoConfig.update({ where: { id: 1 }, data: seoParsed.data });
    }
    invalidateCache();
    await auditLog({
      adminId: auth.admin.id,
      action: 'UPDATE_SITE_CONFIG',
      targetType: 'SITE_CONFIG',
      targetId: '1',
      detail: { site: siteParsed.data, seo: seoParsed.data },
      ip: getClientIp(req),
    });
    return ok({
      site: result.site ?? (await prisma.siteConfig.findUnique({ where: { id: 1 } })),
      seo: result.seo ?? (await prisma.seoConfig.findUnique({ where: { id: 1 } })),
    });
  } catch (e) {
    return handleError(e);
  }
}
