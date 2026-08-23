'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PublicHeader, PublicFooter } from '@/components/layout/PublicLayout';
import { JobCard, type JobCardData } from '@/components/JobCard';
import { api, qs } from '@/lib/api';
import { PageLoading } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Empty } from '@/components/ui/Empty';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { IndustrySelect } from '@/components/ui/IndustrySelect';
import { JOB_TYPE_LABEL, EXPERIENCE_LABEL } from '@/lib/utils';

function JobsContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const [jobs, setJobs] = useState<JobCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const keyword = sp.get('keyword') || '';
  const city = sp.get('city') || '';
  const industryId = sp.get('industry_id') || '';
  const jobTitleId = sp.get('job_title_id') || '';
  const jobType = sp.get('job_type') || '';
  const experience = sp.get('experience') || '';
  const salaryMin = sp.get('salary_min') || '';
  const sort = sp.get('sort') || 'latest';
  const page = Number(sp.get('page')) || 1;
  const pageSize = 20;

  const [kw, setKw] = useState(keyword);

  useEffect(() => {
    setLoading(true);
    api
      .get<JobCardData[]>(
        '/api/jobs' +
          qs({
            keyword: keyword || undefined,
            city: city || undefined,
            industry_id: industryId || undefined,
            job_title_id: jobTitleId || undefined,
            job_type: jobType || undefined,
            experience: experience || undefined,
            salary_min: salaryMin || undefined,
            sort: sort || undefined,
            page,
            pageSize,
          })
      )
      .then((r) => {
        if (r.ok) {
          setJobs(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [keyword, city, industryId, jobTitleId, jobType, experience, salaryMin, sort, page]);

  const setParam = (k: string, v: string) => {
    const params = new URLSearchParams(sp.toString());
    if (!v) params.delete(k);
    else params.set(k, v);
    params.delete('page');
    router.push(`/jobs?${params.toString()}`);
  };

  const doSearch = () => {
    setParam('keyword', kw.trim());
  };

  return (
    <div className="min-h-screen bg-bg">
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* 筛选栏 */}
        <div className="card mb-5 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="关键词（职位/描述）" value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
            <Select
              value={city}
              onChange={(e) => setParam('city', e.target.value)}
            >
              <option value="">全部城市</option>
              {['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '苏州'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <IndustrySelect value={industryId || null} onChange={(v) => setParam('industry_id', v || '')} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <Select value={jobType} onChange={(e) => setParam('job_type', e.target.value)}>
              <option value="">工作类型</option>
              {Object.entries(JOB_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Select value={experience} onChange={(e) => setParam('experience', e.target.value)}>
              <option value="">经验要求</option>
              {Object.entries(EXPERIENCE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Select value={salaryMin} onChange={(e) => setParam('salary_min', e.target.value)}>
              <option value="">最低薪资</option>
              {['5', '10', '15', '20', '30', '50'].map((v) => (
                <option key={v} value={v}>
                  {v}K 以上
                </option>
              ))}
            </Select>
            <Select value={sort} onChange={(e) => setParam('sort', e.target.value)}>
              <option value="latest">最新发布</option>
              <option value="hot">最热</option>
              <option value="salary_desc">薪资从高到低</option>
              <option value="salary_asc">薪资从低到高</option>
            </Select>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-text-secondary">共 {total} 个职位</span>
            <button onClick={doSearch} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover">
              搜索
            </button>
          </div>
        </div>

        {loading ? (
          <PageLoading />
        ) : jobs.length === 0 ? (
          <Empty title="没有符合条件的职位" description="试试调整筛选条件或关键词" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} />
      </div>
      <PublicFooter />
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <JobsContent />
    </Suspense>
  );
}
