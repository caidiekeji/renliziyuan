import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';
import { kickUser } from '@/lib/socket/server';

export const dynamic = 'force-dynamic';

/** 用户详情 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      companies: { include: { company: { select: { id: true, name: true, verify_status: true } } } },
      seeker_posts: { orderBy: { created_at: 'desc' }, take: 10 },
    },
  });
  if (!user) return fail('USER_NOT_FOUND', '用户不存在', 404);
  const { password_hash, ...safe } = user;
  return ok(safe);
}

/** 封禁/解封/角色调整 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.status && ['ACTIVE', 'BANNED'].includes(body.status)) data.status = body.status;
  if (body.role && ['CANDIDATE', 'COMPANY', 'ADMIN'].includes(body.role)) data.role = body.role;
  if (body.chat_muted_until !== undefined) {
    if (body.chat_muted_until === null) {
      data.chat_muted_until = null;
    } else {
      const t = new Date(body.chat_muted_until);
      if (Number.isNaN(t.getTime())) return fail('VALIDATION_ERROR', '禁言时间格式不正确');
      data.chat_muted_until = t;
    }
  }
  // 封禁时立即失效其 refresh token（access 仍短窗口，由 getCurrentUser 的 status 校验兜底）
  if (data.status === 'BANNED') data.refresh_token_version = { increment: 1 };
  try {
    const updated = await prisma.user.update({ where: { id }, data });
    // 封禁 / 禁言后立即踢下线（前端收到 kicked 后跳转/禁止发送）
    if (updated.status === 'BANNED') kickUser(id, '账号已被封禁');
    else if (updated.chat_muted_until && new Date(updated.chat_muted_until) > new Date()) kickUser(id, '账号已被禁言');
    await auditLog({ adminId: auth.admin.id, action: 'UPDATE_USER', targetType: 'USER', targetId: id, detail: body, ip: getClientIp(req) });
    return ok({ id: updated.id, status: updated.status, role: updated.role });
  } catch (e) {
    return handleError(e);
  }
}

/** 注销用户（软删除） */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return fail('USER_NOT_FOUND', '用户不存在', 404);
  // 注销入释放池：phone 可能为 null（邮箱注册或已脱敏），无手机号则不占用释放池
  const poolOps = user.phone
    ? [prisma.phoneReleasePool.create({ data: { phone: user.phone, old_user_id: user.id } })]
    : [];
  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: {
        status: 'DELETED',
        deleted_at: new Date(),
        refresh_token_version: { increment: 1 },
        // 敏感字段脱敏（与用户自助注销一致）
        name: '已注销用户',
        phone: null,
        email: null,
        avatar: null,
        bio: null,
        skills: [],
      },
    }),
    ...poolOps,
  ]);
  kickUser(id, '账号已被注销');
  await auditLog({ adminId: auth.admin.id, action: 'DELETE_USER', targetType: 'USER', targetId: id, ip: getClientIp(req) });
  return ok({ success: true });
}
