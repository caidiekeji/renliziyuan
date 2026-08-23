import { NextRequest, NextResponse } from 'next/server';
import { fail, handleError } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** 数据导出 CSV（users|jobs|companies|payments） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const type = req.nextUrl.searchParams.get('type');
  try {
    let header: string[] = [];
    let rows: Record<string, unknown>[] = [];
    if (type === 'users') {
      header = ['id', 'phone', 'name', 'role', 'status', 'city', 'created_at'];
      rows = await prisma.user.findMany({ take: 5000, orderBy: { created_at: 'desc' } });
    } else if (type === 'jobs') {
      header = ['id', 'title', 'company_id', 'city', 'salary_min', 'salary_max', 'job_type', 'status', 'audit_status', 'created_at'];
      rows = await prisma.job.findMany({ take: 5000, orderBy: { created_at: 'desc' } });
    } else if (type === 'companies') {
      header = ['id', 'name', 'size', 'location', 'verify_status', 'created_at'];
      rows = await prisma.company.findMany({ take: 5000, orderBy: { created_at: 'desc' } });
    } else if (type === 'payments') {
      header = ['id', 'order_no', 'company_id', 'plan_id', 'amount', 'channel', 'status', 'created_at'];
      rows = await prisma.payment.findMany({ take: 5000, orderBy: { created_at: 'desc' } });
    } else {
      return fail('VALIDATION_ERROR', 'type 必须为 users|jobs|companies|payments');
    }
    const lines = rows.map((r) => header.map((h) => csvEscape(r[h])).join(','));
    const csv = [header.map(csvEscape).join(','), ...lines].join('\r\n');
    return new NextResponse('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="admin-${type}-${Date.now()}.csv"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
