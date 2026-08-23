'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { PageLoading } from '@/components/ui/Spinner';

/** 模拟支付页：触发 mock 回调完成订单，展示"模拟支付成功"后自动关闭/返回 */
function MockPayContent() {
  const router = useRouter();
  const { orderNo } = useParams<{ orderNo: string }>();
  const sp = useSearchParams();
  const [state, setState] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('');

  const amount = sp.get('amount');
  const subject = sp.get('subject');

  useEffect(() => {
    let alive = true;
    api.post<{ status: string }>(`/api/payments/mock/${orderNo}/complete`).then((r) => {
      if (!alive) return;
      if (r.ok) {
        setState('success');
        // 由父页面 window.open 打开时可自动关闭，否则返回企业账单页
        setTimeout(() => {
          if (window.opener) {
            window.close();
          } else {
            router.push('/company/billing');
          }
        }, 1200);
      } else {
        setState('error');
        setMessage(r.error?.message || '支付处理失败');
      }
    });
    return () => {
      alive = false;
    };
  }, [orderNo, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-subtle p-4">
      <div className="card w-full max-w-sm p-6 text-center">
        {state === 'processing' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <PageLoading text="正在确认支付…" />
          </div>
        ) : state === 'success' ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-2xl text-accent">✓</div>
            <h1 className="mt-3 text-lg font-bold text-text">模拟支付成功</h1>
            {subject && <p className="mt-1 text-sm text-text-secondary">{subject}</p>}
            {amount != null && <p className="mt-1 text-sm text-text-secondary">金额：¥{amount}</p>}
            <p className="mt-4 text-xs text-text-secondary">支付已完成，正在返回企业后台…</p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-2xl text-danger">✕</div>
            <h1 className="mt-3 text-lg font-bold text-text">支付失败</h1>
            <p className="mt-1 text-sm text-text-secondary">{message}</p>
            <button onClick={() => router.push('/company/billing')} className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
              返回会员与账单
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function MockPayPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <MockPayContent />
    </Suspense>
  );
}
