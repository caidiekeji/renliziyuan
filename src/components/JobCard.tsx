import Link from 'next/link';
import { formatSalary, JOB_TYPE_LABEL, EXPERIENCE_LABEL, formatKm } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Rating } from '@/components/ui/Rating';

export interface JobCardData {
  id: string;
  title: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_unit?: string | null;
  city?: string | null;
  job_type?: string | null;
  experience?: string | null;
  is_featured?: boolean;
  views?: number;
  distance_km?: number | null;
  created_at?: string;
  status?: string;
  is_hourly?: boolean;
  hourly_rate?: number | string | null;
  work_period?: string | null;
  slots?: number | null;
  applied_count?: number | null;
  company?: { id: string; name: string; logo?: string | null; verify_status?: string; avg_rating?: number | null };
  industry?: { id: string; name: string } | null;
  job_title?: { id: string; name: string; category?: string } | null;
}

/** 职位卡片：小时工展示时薪/工作时段/报名进度；action 可选，渲染为卡片底部操作栏（与跳转链接分离） */
export function JobCard({ job, action }: { job: JobCardData; action?: React.ReactNode }) {
  const logo = job.company?.logo;
  const hourly = job.is_hourly;
  const slotsFull = hourly && job.slots != null && (job.applied_count ?? 0) >= job.slots;
  const salaryText = hourly
    ? `¥${Number(job.hourly_rate ?? 0)}/小时`
    : formatSalary(job.salary_min, job.salary_max, job.salary_unit);
  return (
    <div className="card card-hover">
      <Link href={`/jobs/${job.id}`} className="block p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-text">{job.title}</h3>
              {hourly && <Badge tone="success">小时工</Badge>}
              {job.is_featured && <Badge tone="warning">置顶</Badge>}
              {job.job_title?.category && <Badge tone="primary">{job.job_title.category}</Badge>}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
              <span className="max-w-40 truncate">{job.company?.name}</span>
              {job.company?.verify_status === 'VERIFIED' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-accent)" className="shrink-0">
                  <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1.2 13.6-3-3 1.4-1.4 1.6 1.6 3.8-3.8 1.4 1.4-5.2 5.2Z" />
                </svg>
              )}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-bold text-text">{salaryText}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
          {job.city && <Badge tone="neutral">{job.city}</Badge>}
          {job.job_type && <Badge tone="neutral">{JOB_TYPE_LABEL[job.job_type] || job.job_type}</Badge>}
          {hourly && job.work_period && <Badge tone="neutral">{job.work_period}</Badge>}
          {hourly && job.slots != null && (
            <Badge tone={slotsFull ? 'neutral' : 'success'}>已报名 {job.applied_count ?? 0}/{job.slots}</Badge>
          )}
          {job.experience && <Badge tone="neutral">{EXPERIENCE_LABEL[job.experience] || job.experience}</Badge>}
          {job.distance_km != null && <Badge tone="success">📍 {formatKm(job.distance_km)}</Badge>}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-1.5">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-5 w-5 rounded object-cover" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary-soft text-[10px] font-bold text-text">
                {(job.company?.name || '企').slice(0, 1)}
              </span>
            )}
            <Rating value={job.company?.avg_rating} size={12} />
          </div>
          <span className="text-xs text-text-secondary">{job.views ? `${job.views} 浏览` : '新发布'}</span>
        </div>
      </Link>
      {action && <div className="border-t border-border px-4 py-2.5 sm:px-5">{action}</div>}
    </div>
  );
}
