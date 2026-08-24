'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CandidateShell } from '@/components/layout/CandidateShell';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { Rating } from '@/components/ui/Rating';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface ReviewItem {
  id: string;
  rating: number;
  content: string;
  reply?: string | null;
  created_at: string;
  reviewer: { id: string; name: string; avatar?: string | null };
  company?: { id: string; name: string; logo?: string | null } | null;
}

function ReviewsContent() {
  const guarding = useRoleGuard(['CANDIDATE'], '/');
  const sp = useSearchParams();
  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<ReviewItem[]>('/api/me/reviews' + qs({ page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setItems(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [page]);

  if (guarding) return <PageLoading />;

  return (
    <CandidateShell sub="收到的评价">
      {loading ? (
        <PageLoading />
      ) : items.length === 0 ? (
        <Empty title="暂无评价" description="当企业评价您后，评价会显示在这里" />
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Rating value={r.rating} />
                    <span className="text-xs text-text-secondary">{formatDate(r.created_at)}</span>
                  </div>
                  {r.company && <p className="mt-1 text-sm font-medium text-text">{r.company.name}</p>}
                  <p className="mt-1 text-sm text-text-secondary">{r.reviewer.name}</p>
                  <p className="mt-2 text-sm text-text">{r.content}</p>
                  {r.reply && (
                    <div className="mt-2 rounded-lg border-l-2 border-primary bg-primary-soft/30 px-3 py-2.5">
                      <p className="text-xs font-medium text-primary">企业回复</p>
                      <p className="mt-1 text-sm text-text-secondary">{r.reply}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} />
    </CandidateShell>
  );
}

export default function CandidateReviewsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ReviewsContent />
    </Suspense>
  );
}
