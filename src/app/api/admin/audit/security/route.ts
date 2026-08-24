import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 涉安全敏感操作清单（用户注销/封禁类、密钥与支付配置、备份恢复等），按 action 聚合 + 最近记录 */
const SECURITY_ACTIONS = [
  'DELETE_USER',
  'UPDATE_USER', // 封禁/禁言/角色调整均落此 action（detail 含 status/chat_muted_until）
  'DELETE_COMPANY',
  'CLOSE_COMPANY',
  'RESTORE_COMPANY',
  'TRANSFER_COMPANY_OWNER',
  'DELETE_MESSAGE',
  'CLOSE_CONVERSATION',
  'DELETE_REVIEW',
  'BATCH_HIDE_REVIEWS',
  'DELETE_REVIEW_REPLY',
  'REFUND_PAYMENT',
  'UPDATE_SMS_CONFIG',
  'UPDATE_PAYMENT_CONFIG',
  'UPDATE_SITE_CONFIG',
  'UPDATE_RECOMMENDATION_CONFIG',
  'RESTORE_BACKUP',
  'DELETE_BACKUP',
  'BLACKLIST_JOB',
  'UNBLACKLIST_JOB',
  'TEST_SMS',
];

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 30));
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const [byAction, recent, total] = await Promise.all([
    prisma.auditLog.groupBy({
      by: ['action'],
      where: { action: { in: SECURITY_ACTIONS }, created_at: { gte: since } },
      _count: true,
      orderBy: { _count: { action: 'desc' } },
    }),
    prisma.auditLog.findMany({
      where: { action: { in: SECURITY_ACTIONS }, created_at: { gte: since } },
      orderBy: { created_at: 'desc' },
      take: 50,
      include: { admin: { select: { id: true, name: true } } },
    }),
    prisma.auditLog.count({ where: { action: { in: SECURITY_ACTIONS }, created_at: { gte: since } } }),
  ]);

  return ok({
    total,
    days,
    by_action: byAction.map((b) => ({ action: b.action, count: b._count })),
    recent,
  });
}
