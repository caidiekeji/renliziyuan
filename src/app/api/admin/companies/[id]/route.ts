import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';
import { notifyUser } from '@/lib/notification';

export const dynamic = 'force-dynamic';

/** 企业详情 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, phone: true } },
      members: { include: { user: { select: { id: true, name: true, phone: true, role: true } } } },
      subscriptions: { include: { plan: true }, orderBy: { end_at: 'desc' } },
      payments: { orderBy: { created_at: 'desc' }, take: 20 },
    },
  });
  if (!company) return fail('COMPANY_NOT_FOUND', '企业不存在', 404);
  return ok(company);
}

/** 企业认证审核 / 资料修改 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.verify_status && ['PENDING', 'VERIFIED', 'REJECTED'].includes(body.verify_status)) data.verify_status = body.verify_status;
  const editable = ['name', 'size', 'location', 'contact_phone', 'website', 'description', 'industry_id', 'logo'];
  for (const k of editable) {
    if (body[k] === undefined) continue;
    const v = body[k];
    // 字段值校验：长度上限 + 联系电话/网址格式
    if (k === 'name' && (typeof v !== 'string' || !v.trim() || v.length > 100)) return fail('VALIDATION_ERROR', '企业名称不合法');
    if (k === 'contact_phone' && v !== null && typeof v === 'string' && v && !/^1[3-9]\d{9}$/.test(v)) return fail('VALIDATION_ERROR', '联系电话格式不正确');
    if (k === 'website' && v !== null && typeof v === 'string' && v && !/^https?:\/\/.+/i.test(v)) return fail('VALIDATION_ERROR', '网址格式不正确');
    if (typeof v === 'string' && v.length > 2000) return fail('VALIDATION_ERROR', `${k} 内容过长`);
    data[k] = v;
  }

  const updated = await prisma.company.update({ where: { id }, data });
  await auditLog({ adminId: auth.admin.id, action: 'UPDATE_COMPANY', targetType: 'COMPANY', targetId: id, detail: body, ip: getClientIp(req) });

  // 认证结果通知
  if (body.verify_status === 'VERIFIED' || body.verify_status === 'REJECTED') {
    await notifyUser({
      userId: updated.owner_id,
      type: 'COMPANY_VERIFY',
      title: body.verify_status === 'VERIFIED' ? '企业认证通过' : '企业认证未通过',
      body: `「${updated.name}」认证状态已更新为 ${body.verify_status}`,
      link: '/company',
    });
  }
  return ok(updated);
}

/** 删除企业（软删：企业、职位下线） */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) return fail('COMPANY_NOT_FOUND', '企业不存在', 404);
  await prisma.$transaction([
    prisma.job.updateMany({ where: { company_id: id, deleted_at: null }, data: { status: 'CLOSED', closed_reason: 'ADMIN', deleted_at: new Date() } }),
    prisma.companyMember.updateMany({ where: { company_id: id, status: 'ACTIVE' }, data: { status: 'REMOVED' } }),
    prisma.company.update({ where: { id }, data: { name: `[已删除]${company.name}`.slice(0, 100) } }),
  ]);
  await auditLog({ adminId: auth.admin.id, action: 'DELETE_COMPANY', targetType: 'COMPANY', targetId: id, ip: getClientIp(req) });
  return ok({ success: true });
}
