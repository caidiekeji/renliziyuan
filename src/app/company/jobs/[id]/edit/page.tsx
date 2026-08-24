'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CompanyShell, CompanyGuard } from '@/components/company/CompanyShell';
import { JobForm } from '@/components/company/JobForm';
import { Empty } from '@/components/ui/Empty';
import { PageLoading } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth-context';
import { useRoleGuard } from '@/lib/route-guard';
import { fetchJobDetail, type JobItem } from '@/lib/company';

export default function EditJobPage() {
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  const { id } = useParams<{ id: string }>();
  const { companyId } = useAuth();
  const [job, setJob] = useState<JobItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (id && companyId) {
      setLoading(true);
      fetchJobDetail(id, companyId).then((j) => {
        if (alive) {
          setJob(j);
          setLoading(false);
        }
      });
    }
    return () => {
      alive = false;
    };
  }, [id, companyId]);

  if (guarding) return <PageLoading />;

  return (
    <CompanyShell>
      <CompanyGuard>
        <h1 className="mb-5 text-xl font-semibold text-text">编辑职位</h1>
        {loading ? (
          <PageLoading />
        ) : !job ? (
          <Empty title="职位不存在或已下线" description="该职位可能已被删除，请返回职位管理查看" />
        ) : (
          <JobForm mode="edit" initial={job} />
        )}
      </CompanyGuard>
    </CompanyShell>
  );
}
