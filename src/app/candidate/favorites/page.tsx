'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CandidateShell } from '@/components/layout/CandidateShell';
import { JobCard, type JobCardData } from '@/components/JobCard';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { Empty } from '@/components/ui/Empty';
import { PageLoading } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';

interface FavoriteItem {
  id: string;
  created_at?: string;
  job: JobCardData;
}

const PAGE_SIZE = 12;

function FavoritesContent() {
  const guarding = useRoleGuard(['CANDIDATE'], '/');
  const sp = useSearchParams();
  const { toast } = useToast();
  const page = Number(sp.get('page')) || 1;
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<FavoriteItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<FavoriteItem[]>(`/api/me/favorites?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((r) => {
        if (r.ok) {
          setItems(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [page]);

  useEffect(load, [load]);

  const remove = async () => {
    if (!removing) return;
    setDeleting(true);
    const res = await api.del(`/api/me/favorites/${removing.job.id}`);
    setDeleting(false);
    if (!res.ok) return toast('error', res.error?.message || '取消失败');
    toast('success', '已取消收藏');
    setRemoving(null);
    load();
  };

  if (guarding) return <PageLoading />;

  return (
    <CandidateShell sub="我的收藏">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text">我的收藏（{total}）</h1>
      </div>

      {loading ? (
        <PageLoading />
      ) : items.length === 0 ? (
        <Empty title="暂无收藏" description="去职位列表收藏感兴趣的职位" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => (
            <div key={f.id} className="flex flex-col">
              <JobCard job={f.job} />
              <div className="mt-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setRemoving(f)}>取消收藏</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />

      <ConfirmDialog
        open={!!removing}
        title="取消收藏"
        message={`确定取消收藏「${removing?.job.title || ''}」吗？`}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
        confirmText="取消收藏"
        loading={deleting}
      />
    </CandidateShell>
  );
}

export default function FavoritesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <FavoritesContent />
    </Suspense>
  );
}
