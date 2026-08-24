'use client';

import { useRoleGuard } from '@/lib/route-guard';
import { PageLoading } from '@/components/ui/Spinner';
import { CompanyShell } from '@/components/company/CompanyShell';
import { ConversationList } from '@/components/chat/ConversationList';

export default function CompanyMessagesPage() {
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  if (guarding) return <PageLoading />;
  return (
    <CompanyShell>
      <ConversationList basePath="/company/messages" viewAs="company" />
    </CompanyShell>
  );
}
