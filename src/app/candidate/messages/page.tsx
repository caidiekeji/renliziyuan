'use client';

import { useRoleGuard } from '@/lib/route-guard';
import { PageLoading } from '@/components/ui/Spinner';
import { CandidateShell } from '@/components/layout/CandidateShell';
import { ConversationList } from '@/components/chat/ConversationList';

export default function CandidateMessagesPage() {
  const guarding = useRoleGuard(['CANDIDATE'], '/');
  if (guarding) return <PageLoading />;
  return (
    <CandidateShell sub="消息">
      <ConversationList basePath="/candidate/messages" viewAs="candidate" />
    </CandidateShell>
  );
}
