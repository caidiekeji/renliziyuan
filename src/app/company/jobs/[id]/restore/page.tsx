'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CompanyShell, CompanyGuard } from '@/components/company/CompanyShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { PageLoading } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { useRoleGuard } from '@/lib/route-guard';
import { api } from '@/lib/api';
import { fetchJobDetail, type JobItem, CLOSED_REASON_LABEL } from '@/lib/company';
import { JOB_STATUS_LABEL, AUDIT_STATUS_LABEL, formatSalary, formatDate, JOB_TYPE_LABEL } from '@/lib/utils';

export default function RestoreJobPage() {
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  const router = useRouter();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const { companyId } = useAuth();
  const [job, setJob] = useState<JobItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);

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

  const restore = async () => {
    if (!job) return;
    setRestoring(true);
    const res = await api.post<{ status: string }>(`/api/jobs/${job.id}/reopen`);
    setRestoring(false);
    if (!res.ok) {
      if (res.error?.error === 'JOB_LIMIT_EXCEEDED') {
        toast('error', `${res.error.message}，可在「会员与账单」升级套餐`);
      } else {
        toast('error', res.error?.message || '恢复失败');
      }
      return;
    }
    toast('success', res.data?.status === 'PENDING_AUDIT' ? '已重新提交审核' : '职位已重新上线');
    router.push('/company/jobs');
  };

  return (
    <CompanyShell>
      <CompanyGuard>
        <h1 className="mb-5 text-xl font-semibold text-text">恢复职位</h1>
        {loading ? (
          <PageLoading />
        ) : !job ? (
          <Empty title="职位不存在" description="该职位可能已被删除，请返回职位管理查看" />
        ) : (
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-text">{job.title}</h2>
              <Badge tone={job.status === 'OPEN' ? 'success' : 'neutral'}>{JOB_STATUS_LABEL[job.status] || job.status}</Badge>
              {job.audit_status !== 'APPROVED' && (
                <Badge tone={job.audit_status === 'PENDING' ? 'warning' : 'danger'}>
                  {AUDIT_STATUS_LABEL[job.audit_status] || job.audit_status}
                </Badge>
              )}
              {job.closed_reason && <Badge tone="neutral">{CLOSED_REASON_LABEL[job.closed_reason] || job.closed_reason}</Badge>}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
              <span className="font-semibold text-text">{formatSalary(job.salary_min, job.salary_max, job.salary_unit)}</span>
              {job.city && <span>{job.city}</span>}
              {job.job_type && <span>{JOB_TYPE_LABEL[job.job_type] || job.job_type}</span>}
              {job.views != null && <span>{job.views} 浏览</span>}
              <span>发布于 {formatDate(job.created_at)}</span>
            </div>

            {job.tags && job.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {job.tags.map((t) => (
                  <Badge key={t} tone="default">{t}</Badge>
                ))}
              </div>
            )}

            {job.description && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{job.description}</p>
            )}

            <div className="mt-6 border-t border-border pt-4">
              <p className="text-sm text-text-secondary">
                {job.closed_reason === 'QUOTA_EXCEEDED'
                  ? '该职位因套餐职位名额超出被系统回收。恢复后将占用一个新的职位名额，请确认配额充足后再恢复。'
                  : '恢复后职位将重新上线（前置审核模式下将重新提交审核）。'}
              </p>
              <div className="mt-4 flex gap-2">
                <Button onClick={restore} loading={restoring}>恢复职位</Button>
                <Button variant="ghost" onClick={() => router.push('/company/jobs')}>返回职位管理</Button>
              </div>
            </div>
          </Card>
        )}
      </CompanyGuard>
    </CompanyShell>
  );
}
