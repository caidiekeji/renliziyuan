'use client';

import { useParams } from 'next/navigation';
import { useRoleGuard } from '@/lib/route-guard';
import { PageLoading } from '@/components/ui/Spinner';
import { ChatWindow } from '@/components/chat/ChatWindow';

export default function CandidateChatPage() {
  const { id } = useParams<{ id: string }>();
  const guarding = useRoleGuard(['CANDIDATE'], '/');
  if (guarding) return <PageLoading />;
  return <ChatWindow conversationId={id} viewAs="candidate" backPath="/candidate/messages" />;
}
