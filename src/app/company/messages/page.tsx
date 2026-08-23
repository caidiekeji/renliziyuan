'use client';

import { useRoleGuard } from '@/lib/route-guard';
import { PageLoading } from '@/components/ui/Spinner';
import { ConversationList } from '@/components/chat/ConversationList';

export default function CompanyMessagesPage() {
  // 企业成员主角色可能与 COMPANY 不同，仅校验登录即可（COMPANY / CANDIDATE）
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  if (guarding) return <PageLoading />;
  return <ConversationList basePath="/company/messages" title="消息" viewAs="company" />;
}
