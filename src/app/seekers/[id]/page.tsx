'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PublicHeader, PublicFooter } from '@/components/layout/PublicLayout';
import { api } from '@/lib/api';
import { PageLoading } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { PhoneButton } from '@/components/ui/PhoneButton';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { formatSalary, formatDate, JOB_TYPE_LABEL, EXPERIENCE_LABEL, timeAgo } from '@/lib/utils';
import type { SeekerPost } from '@/app/seekers/page';

function SeekerDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [post, setPost] = useState<SeekerPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatting, setChatting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<SeekerPost>(`/api/seeker-posts/${id}`).then((r) => {
      if (cancelled) return;
      if (r.ok) setPost(r.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleChat = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    setChatting(true);
    const res = await api.post<{ id: string; existing: boolean }>('/api/conversations', { seeker_post_id: id });
    setChatting(false);
    if (!res.ok) return toast('error', res.error?.message || '发起沟通失败');
    // 企业成员进入企业管理端会话，求职者进入个人会话
    router.push(user.role === 'COMPANY' || user.role === 'ADMIN' ? `/company/messages/${res.data.id}` : `/candidate/messages/${res.data.id}`);
  };

  if (loading) return <PageLoading />;

  if (!post) {
    return (
      <div className="min-h-screen bg-bg">
        <PublicHeader />
        <Empty
          title="该求职信息不存在"
          description="信息可能已被删除或下线"
          action={
            <Button onClick={() => router.push('/seekers')}>返回人才广场</Button>
          }
        />
        <PublicFooter />
      </div>
    );
  }

  const u = post.user;

  return (
    <div className="min-h-screen bg-bg">
      <PublicHeader />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="card p-5 sm:p-6">
          {/* 用户信息 */}
          <div className="flex items-center gap-3 border-b border-border pb-4">
            {u.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.avatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-text">
                {u.name.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-base font-semibold text-text">{u.name}</p>
              {u.title && <p className="truncate text-sm text-text-secondary">{u.title}</p>}
            </div>
          </div>

          {/* 标题 + 期望薪资 */}
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 text-xl font-bold text-text sm:text-2xl">{post.title}</h1>
            <p className="shrink-0 text-2xl font-bold text-text">{formatSalary(post.expected_salary_min, post.expected_salary_max)}</p>
          </div>

          {/* 标签 */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.city && <Badge tone="neutral">{post.city}</Badge>}
            {post.job_type && <Badge tone="neutral">{JOB_TYPE_LABEL[post.job_type] || post.job_type}</Badge>}
            {post.experience && <Badge tone="neutral">{EXPERIENCE_LABEL[post.experience] || post.experience}</Badge>}
            {post.education && <Badge tone="neutral">{post.education}</Badge>}
          </div>

          {/* 技能 */}
          {post.skills && post.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.skills.map((s) => (
                <Badge key={s} tone="primary">
                  {s}
                </Badge>
              ))}
            </div>
          )}

          {/* 描述 */}
          <div className="mt-5 border-t border-border pt-5">
            <h2 className="mb-2 text-sm font-semibold text-text">求职意向</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{post.description || '暂无描述'}</p>
          </div>

          {/* 元信息 */}
          <div className="mt-5 border-t border-border pt-4 text-xs text-text-secondary">
            <div className="flex justify-between py-1">
              <span>发布时间</span>
              <span>{timeAgo(post.created_at)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>发布日期</span>
              <span>{formatDate(post.created_at)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>浏览次数</span>
              <span>{post.views || 0}</span>
            </div>
          </div>

          {/* 操作 */}
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4 sm:flex-nowrap">
            <Button variant="secondary" className="min-w-24 flex-1" onClick={handleChat} loading={chatting}>
              {chatting ? '发起中…' : '私聊'}
            </Button>
            {post.show_phone && <PhoneButton type="SEEKER_POST" targetId={post.id} className="min-w-24 flex-1" />}
            <Button variant="ghost" className="min-w-24 flex-1" onClick={() => router.push('/seekers')}>
              返回人才广场
            </Button>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}

export default function SeekerDetailPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <SeekerDetailContent />
    </Suspense>
  );
}
