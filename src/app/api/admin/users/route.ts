import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 用户列表（含筛选/分页/导出参数） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const url = req.nextUrl;
  const keyword = url.searchParams.get('keyword')?.trim();
  const role = url.searchParams.get('role');
  const status = url.searchParams.get('status');
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

  const where: any = { status: { not: 'DELETED' } };
  if (role) where.role = role;
  if (status) where.status = status;
  if (keyword) {
    where.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { phone: { contains: keyword } },
    ];
  }
  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, phone: true, name: true, avatar: true, role: true, status: true, city: true, title: true,
        created_at: true, last_login_at: true, deleted_at: true,
      },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}

/** 新增用户（管理员代建） */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { phone, name, role, password } = await req.json().catch(() => ({}));
  if (!phone || !name || !role) return fail('VALIDATION_ERROR', '参数不完整');
  // 角色白名单：仅允许创建 CANDIDATE/COMPANY，禁止创建管理员
  if (!['CANDIDATE', 'COMPANY'].includes(role)) return fail('VALIDATION_ERROR', '非法的角色');
  if (!/^1[3-9]\d{9}$/.test(phone)) return fail('VALIDATION_ERROR', '手机号格式不正确');
  try {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) return fail('PHONE_EXISTS', '手机号已存在');
    const bcrypt = await import('bcryptjs');
    const user = await prisma.user.create({
      data: { phone, name, role, password_hash: password ? await bcrypt.hash(password, 10) : undefined, skills: [] },
    });
    return ok({ id: user.id });
  } catch (e) {
    return handleError(e);
  }
}
