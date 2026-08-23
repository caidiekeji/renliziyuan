import { createWorker } from '../index';
import { prisma } from '@/lib/db/prisma';

/** 异步通知投递（站内消息已实时创建，此处负责多渠道扩展占位） */
export function startNotifyWorker() {
  return createWorker('notifications', async ({ id }: { id: string }) => {
    await prisma.notification.findUnique({ where: { id } });
  });
}
