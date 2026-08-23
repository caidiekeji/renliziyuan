'use client';

import { useRoleGuard } from '@/lib/route-guard';
import { PageLoading } from '@/components/ui/Spinner';
import { ConversationList } from '@/components/chat/ConversationList';

export default function CandidateMessagesPage() {
  const guarding = useRoleGuard(['CANDIDATE'], '/');
  if (guarding) return <PageLoading />;
  return <ConversationList basePath="/candidate/messages" title="消息" viewAs="candidate" />;
}
