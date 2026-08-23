'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PublicHeader, PublicFooter } from '@/components/layout/PublicLayout';
import { api, qs } from '@/lib/api';
import { PageLoading } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Empty } from '@/components/ui/Empty';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PhoneButton } from '@/components/ui/PhoneButton';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { formatSalary, JOB_TYPE_LABEL, EXPERIENCE_LABEL, timeAgo } from '@/lib/utils';

/** 求职信息公开列表项（联系方式已脱敏，show_phone 恒为 false） */
export interface SeekerPost {
  id: string;
  user_id: string;
  title: string;
  expected_salary_min?: number | null;
  expected_salary_max?: number | null;
  city: string;
  job_type?: string | null;
  experience?: string | null;
  education?: string | null;
  skills?: string[];
  description?: string | null;
  show_phone: boolean;
  status: string;
  views: number;
  created_at: string;
  user: { id: string; name: string; avatar?: string | null; title?: string | null };
}

function SeekerCard({ post, onChat }: { post: SeekerPost; onChat: (p: SeekerPost) => void }) {
  const u = post.user;
  return (
    <div className="card card-hover flex flex-col p-4 sm:p-5">
      {/* 用户头像/姓名 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {u.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-text">
              {u.name.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{u.name}</p>
            {u.title && <p className="truncate text-xs text-text-secondary">{u.title}</p>}
          </div>
        </div>
        <span className="shrink-0 text-xs text-text-secondary">{timeAgo(post.created_at)}</span>
      </div>

      {/* 标题 + 期望薪资 */}
      <div className="mt-3 flex items-start justify-between gap-3">
        <Link href={`/seekers/${post.id}`} className="min-w-0 truncate text-base font-semibold text-text hover:text-text">
          {post.title}
        </Link>
        <p className="shrink-0 text-base font-bold text-text">{formatSalary(post.expected_salary_min, post.expected_salary_max)}</p>
      </div>

      {/* 标签 */}
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {post.city && <Badge tone="neutral">{post.city}</Badge>}
        {post.job_type && <Badge tone="neutral">{JOB_TYPE_LABEL[post.job_type] || post.job_type}</Badge>}
        {post.experience && <Badge tone="neutral">{EXPERIENCE_LABEL[post.experience] || post.experience}</Badge>}
        {post.education && <Badge tone="neutral">{post.education}</Badge>}
      </div>

      {/* 技能 */}
      {post.skills && post.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {post.skills.slice(0, 5).map((s) => (
            <Badge key={s} tone="primary">
              {s}
            </Badge>
          ))}
          {post.skills.length > 5 && <Badge tone="default">+{post.skills.length - 5}</Badge>}
        </div>
      )}

      {/* 描述 */}
      {post.description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-text-secondary">{post.description}</p>}

      {/* 底部操作 */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-text-secondary">{post.views ? `${post.views} 浏览` : '新发布'}</span>
        <div className="flex gap-2">
          {post.show_phone && <PhoneButton type="SEEKER_POST" targetId={post.id} className="!px-2.5 !py-1.5 !text-xs" />}
          <Button variant="secondary" size="sm" onClick={() => onChat(post)}>
            私聊
          </Button>
          <Link
            href={`/seekers/${post.id}`}
            className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text"
          >
            查看详情
          </Link>
        </div>
      </div>
    </div>
  );
}

function SeekersContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<SeekerPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<string[]>([]);

  const city = sp.get('city') || '';
  const page = Number(sp.get('page')) || 1;
  const pageSize = 20;

  useEffect(() => {
    api.get<{ id: string; name: string }[]>('/api/cities').then((r) => {
      if (r.ok) setCities(r.data.map((c) => c.name));
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get<SeekerPost[]>('/api/seeker-posts' + qs({ city: city || undefined, page, pageSize })).then((r) => {
      if (r.ok) {
        setPosts(r.data);
        setTotal(Number(r.meta?.total) || 0);
      }
      setLoading(false);
    });
  }, [city, page]);

  const setParam = (k: string, v: string) => {
    const params = new URLSearchParams(sp.toString());
    if (!v) params.delete(k);
    else params.set(k, v);
    params.delete('page');
    router.push(`/seekers?${params.toString()}`);
  };

  const handleChat = async (post: SeekerPost) => {
    if (!user) {
      router.push('/login');
      return;
    }
    const res = await api.post<{ id: string; existing: boolean }>('/api/conversations', { seeker_post_id: post.id });
    if (!res.ok) return toast('error', res.error?.message || '发起沟通失败');
    router.push(user.role === 'COMPANY' || user.role === 'ADMIN' ? `/company/messages/${res.data.id}` : `/candidate/messages/${res.data.id}`);
  };

  return (
    <div className="min-h-screen bg-bg">
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* 筛选栏 */}
        <div className="card mb-5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-64">
              <Select value={city} onChange={(e) => setParam('city', e.target.value)}>
                <option value="">全部城市</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <span className="text-xs text-text-secondary">共 {total} 位求职者</span>
          </div>
        </div>

        {loading ? (
          <PageLoading />
        ) : posts.length === 0 ? (
          <Empty title="暂无求职信息" description="还没有求职者发布信息，试试其他城市" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <SeekerCard key={p.id} post={p} onChat={handleChat} />
            ))}
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} />
      </div>
      <PublicFooter />
    </div>
  );
}

export default function SeekersPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <SeekersContent />
    </Suspense>
  );
}
