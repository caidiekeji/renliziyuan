'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageLoading } from '@/components/ui/Spinner';
import { useRoleGuard } from '@/lib/route-guard';
import { api } from '@/lib/api';
import { ADMIN_NAV } from '@/lib/admin-nav';

interface DashboardCounts {
  totalUsers: number;
  totalJobs: number;
  activeCompanies: number;
  totalPayments: number;
}

const EXPORTS = [
  { type: 'users', label: '导出用户', desc: '用户基础信息（含手机号/角色/状态）' },
  { type: 'jobs', label: '导出职位', desc: '职位数据（含薪资/审核状态）' },
  { type: 'companies', label: '导出企业', desc: '企业数据（含认证状态）' },
  { type: 'payments', label: '导出支付', desc: '支付流水（含金额/渠道/状态）' },
];

export default function AdminExportPage() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const [counts, setCounts] = useState<DashboardCounts | null>(null);

  useEffect(() => {
    api.get<DashboardCounts>('/api/admin/dashboard').then((r) => {
      if (r.ok) setCounts(r.data);
    });
  }, []);

  if (guarding) return <PageLoading />;

  const countMap: Record<string, number | undefined> = {
    users: counts?.totalUsers,
    jobs: counts?.totalJobs,
    companies: counts?.activeCompanies,
    payments: counts?.totalPayments,
  };

  const doExport = (type: string) => {
    window.open(`/api/admin/export?type=${type}`, '_blank');
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="报表导出">
      <h1 className="mb-4 text-lg font-bold text-text">报表导出</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {EXPORTS.map((e) => (
          <Card key={e.type}>
            <p className="text-sm font-semibold text-text">{e.label}</p>
            <p className="mt-1 min-h-9 text-xs text-text-secondary">{e.desc}</p>
            <p className="mt-2 text-xs text-text-secondary">
              今日数据量：<span className="font-medium text-text">{countMap[e.type] ?? '-'}</span>
            </p>
            <Button className="mt-3 w-full" size="sm" onClick={() => doExport(e.type)}>
              立即导出
            </Button>
          </Card>
        ))}
      </div>

      <p className="mt-4 text-xs text-text-secondary">
        说明：点击导出将生成 UTF-8 BOM CSV，含表头；文件通过浏览器直接下载，请勿在公共电脑上长期留存，注意数据脱敏。
      </p>
    </DashboardShell>
  );
}
