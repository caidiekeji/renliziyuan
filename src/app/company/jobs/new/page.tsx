'use client';

import { CompanyShell, CompanyGuard } from '@/components/company/CompanyShell';
import { JobForm } from '@/components/company/JobForm';
import { PageLoading } from '@/components/ui/Spinner';
import { useRoleGuard } from '@/lib/route-guard';

export default function NewJobPage() {
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  if (guarding) return <PageLoading />;

  return (
    <CompanyShell>
      <CompanyGuard>
        <h1 className="mb-4 text-lg font-bold text-text">发布职位</h1>
        <JobForm mode="create" />
      </CompanyGuard>
    </CompanyShell>
  );
}
