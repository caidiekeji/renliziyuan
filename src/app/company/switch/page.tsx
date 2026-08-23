'use client';

import { useRouter } from 'next/navigation';
import { CompanyShell } from '@/components/company/CompanyShell';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { Rating } from '@/components/ui/Rating';
import { PageLoading } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth-context';
import { useRoleGuard } from '@/lib/route-guard';
import { useMyCompanies, sortMyCompanies, COMPANY_ROLE_LABEL, type MyCompanyEntry } from '@/lib/company';
import { COMPANY_VERIFY_LABEL } from '@/lib/utils';

function CompanyLogo({ entry, size = 'h-12 w-12 text-xl' }: { entry: MyCompanyEntry; size?: string }) {
  const { company } = entry;
  if (company.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={company.logo} alt="" className={`${size} shrink-0 rounded-xl object-cover`} />;
  }
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-xl bg-primary-soft font-bold text-text`}>
      {company.name.slice(0, 1)}
    </span>
  );
}

export default function CompanySwitchPage() {
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  const { setCompanyId } = useAuth();
  const router = useRouter();
  const { entries, loading } = useMyCompanies();
  const sorted = sortMyCompanies(entries);

  if (guarding) return <PageLoading />;

  const pick = (id: string) => {
    setCompanyId(id);
    router.push('/company');
  };

  return (
    <CompanyShell>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-text">切换企业</h1>
        <p className="mt-1 text-sm text-text-secondary">选择要进入的企业工作台</p>
      </div>

      {loading ? (
        <PageLoading />
      ) : sorted.length === 0 ? (
        <Empty title="你还没有加入任何企业" description="请先在企业端注册并创建企业" />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((e) => (
            <button
              key={e.company.id}
              onClick={() => pick(e.company.id)}
              className="card card-hover flex w-full items-center gap-4 p-4 text-left sm:p-5"
            >
              <CompanyLogo entry={e} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-text">{e.company.name}</h3>
                  <Badge tone={e.company.verify_status === 'VERIFIED' ? 'success' : 'default'}>
                    {COMPANY_VERIFY_LABEL[e.company.verify_status] || e.company.verify_status}
                  </Badge>
                  {e.status === 'INVITED' && <Badge tone="warning">待接受</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                  {e.company.industry && <span>行业：{e.company.industry.name}</span>}
                  <span className="font-medium text-text">{COMPANY_ROLE_LABEL[e.role] || e.role}</span>
                  <span className="inline-flex items-center gap-1">
                    <Rating value={e.company.avg_rating} size={12} />
                    {e.company.review_count ? `${e.company.review_count} 条评价` : '暂无评价'}
                  </span>
                </div>
                <div className="mt-2 text-xs text-text-secondary">
                  {e.subscription?.plan ? `当前套餐：${e.subscription.plan.name}` : '当前套餐：免费版'}
                  <span className="mx-1.5">·</span>
                  在招职位 {e.open_job_count}
                </div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-text-secondary">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </CompanyShell>
  );
}
