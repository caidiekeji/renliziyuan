import { NextResponse } from 'next/server';
import type { User } from '@prisma/client';
import { getUserFromRequest } from './session';
import { prisma } from '@/lib/db/prisma';

export type AdminCtx = { admin: User };

export function adminError(status = 403): NextResponse {
  return NextResponse.json({ error: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', message: status === 401 ? '未登录' : '需要管理员权限' }, { status });
}

/** 校验管理员身份 */
export async function requireAdmin(): Promise<{ admin: User } | { error: NextResponse }> {
  const user = await getUserFromRequest();
  if (!user) return { error: adminError(401) };
  if (user.role !== 'ADMIN') return { error: adminError(403) };
  return { admin: user };
}

/** 记录管理员操作审计（旁路：失败仅记日志，不阻塞主业务） */
export async function auditLog(params: {
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  detail?: unknown;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        admin_id: params.adminId,
        action: params.action,
        target_type: params.targetType,
        target_id: params.targetId || undefined,
        detail: (params.detail ?? null) as any,
        ip: params.ip || undefined,
      },
    });
  } catch (e: any) {
    // 审计失败不影响主业务
    console.error('[auditLog] failed', e?.message);
  }
}
