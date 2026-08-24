'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';

interface CallResult {
  callee_phone: string;
  masked: boolean;
}

/**
 * 一键电话：点击后向 /api/call 请求号码（服务端校验可见性）→ 移动端 tel: 唤起拨号；桌面端复制
 * type: JOB（求职者→企业职位）| SEEKER_POST（企业→求职信息）
 */
export function PhoneButton({
  type,
  targetId,
  disabled,
  className = '',
  children,
}: {
  type: 'JOB' | 'SEEKER_POST';
  targetId: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  // 移动端判断放 effect 内，避免 SSR/客户端首次渲染不一致导致 hydration 警告
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));
  }, []);

  const handle = async () => {
    setLoading(true);
    const res = await api.post<CallResult>('/api/call', { type, target_id: targetId });
    setLoading(false);
    if (!res.ok) {
      toast('error', res.error?.message || '无法获取号码');
      return;
    }
    const phone = res.data.callee_phone;
    if (res.data.masked) toast('info', '需要会员套餐才能查看完整联系方式');
    if (isMobile) {
      if (!res.data.masked) window.location.href = `tel:${phone}`;
    } else {
      navigator.clipboard.writeText(phone).then(() => toast('success', `号码 ${phone} 已复制`));
    }
  };

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={handle}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-accent bg-accent-soft px-4 h-11 text-sm font-medium text-accent transition-colors duration-200 hover:bg-accent hover:text-white disabled:opacity-50 ${className}`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" />
      </svg>
      {loading ? '获取中…' : children || '一键电话'}
    </button>
  );
}
