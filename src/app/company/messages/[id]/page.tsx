'use client';

import { useParams } from 'next/navigation';
import { useRoleGuard } from '@/lib/route-guard';
import { PageLoading } from '@/components/ui/Spinner';
import { ChatWindow } from '@/components/chat/ChatWindow';

export default function CompanyChatPage() {
  const { id } = useParams<{ id: string }>();
  // 企业成员主角色可能与 COMPANY 不同，仅校验登录即可（COMPANY / CANDIDATE）
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  if (guarding) return <PageLoading />;
  return <ChatWindow conversationId={id} viewAs="company" backPath="/company/messages" />;
}
