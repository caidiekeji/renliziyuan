import { ensureRedis } from '@/lib/db/redis';

/** 全局通知类消息发送（占位；真实实现可接站内 + 短信/邮件网关） */
export type NotifyPayload = {
  userId: string;
  type: 'NEW_MESSAGE' | 'NEW_REVIEW' | 'REVIEW_REPLY' | 'JOB_AUDIT' | 'COMPANY_VERIFY' | 'PLAN_EXPIRE' | 'BOOST_OVERTAKEN' | 'BOOST_BALANCE_LOW' | 'SYSTEM';
  title: string;
  body?: string;
  link?: string;
  channel?: 'INAPP' | 'SMS' | 'EMAIL';
};

/** 站内通知（写库）+ 未读数 Redis 递增 */
export async function notifyUser(p: NotifyPayload) {
  const { prisma } = await import('@/lib/db/prisma');
  const channel = p.channel || 'INAPP';
  await prisma.notification.create({
    data: {
      user_id: p.userId,
      type: p.type,
      title: p.title,
      body: p.body,
      link: p.link,
      channel,
    },
  });
  try {
    const r = await ensureRedis();
    await r.incr(`unread:${p.userId}`);
  } catch {
    // Redis 不可用时忽略（通知已落库）
  }
}

/** 读取未读数 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const r = await ensureRedis();
    return Number((await r.get(`unread:${userId}`)) || 0);
  } catch {
    return 0;
  }
}

/** 清空未读数 */
export async function clearUnread(userId: string) {
  try {
    const r = await ensureRedis();
    await r.del(`unread:${userId}`);
  } catch {
    // ignore
  }
}
