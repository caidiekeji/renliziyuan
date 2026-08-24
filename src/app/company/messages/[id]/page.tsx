'use client';

import { useParams } from 'next/navigation';
import { useRoleGuard } from '@/lib/route-guard';
import { PageLoading } from '@/components/ui/Spinner';
import { ChatWindow } from '@/components/chat/ChatWindow';

export default function CompanyChatPage() {
  const { id } = useParams<{ id: string }>();
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  if (guarding) return <PageLoading />;
  // 聊天窗口独立全屏布局（自带返回头与输入框），避免被顶栏/底部 Tab 遮挡
  return <ChatWindow conversationId={id} viewAs="company" backPath="/company/messages" />;
}
