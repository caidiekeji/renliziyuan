import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';
import { notifyUser } from '@/lib/notification';

export const dynamic = 'force-dynamic';

/** 企业整体关停 / 恢复：status=CLOSED 时级联下线所有在招职位；恢复仅解封企业（职位由管理员逐个恢复） */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action === 'restore' ? 'restore' : 'close';

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) return fail('COMPANY_NOT_FOUND', '企业不存在', 404);

  if (action === 'close') {
    if (company.status === 'CLOSED') return fail('COMPANY_CLOSED', '企业已处于关停状态');
    await prisma.$transaction([
      prisma.company.update({ where: { id }, data: { status: 'CLOSED' } }),
      prisma.job.updateMany({
        where: { company_id: id, status: 'OPEN', deleted_at: null },
        data: { status: 'CLOSED', closed_reason: 'ADMIN' },
      }),
    ]);
  } else {
    if (company.status === 'ACTIVE') return fail('COMPANY_ACTIVE', '企业当前为正常状态');
    await prisma.company.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  await notifyUser({
    userId: company.owner_id,
    type: 'COMPANY_VERIFY',
    title: action === 'close' ? '企业已被管理员关停' : '企业已恢复运营',
    body: `「${company.name}」${action === 'close' ? '已关停，在招职位已全部下线' : '已恢复，可重新上线职位'}`,
    link: '/company',
  });

  await auditLog({
    adminId: auth.admin.id,
    action: action === 'close' ? 'CLOSE_COMPANY' : 'RESTORE_COMPANY',
    targetType: 'COMPANY',
    targetId: id,
    ip: getClientIp(req),
  });
  return ok({ success: true, status: action === 'close' ? 'CLOSED' : 'ACTIVE' });
}
