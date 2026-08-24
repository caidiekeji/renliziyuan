import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { prisma } from '@/lib/db/prisma';
import { ensureRedis } from '@/lib/db/redis';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { rateLimit } from '@/lib/middleware/rate-limit';
import { getSiteConfig } from '@/lib/config';
import { notifyUser } from '@/lib/notification';
import { log } from '@/lib/logger';

let io: Server | null = null;

export function getIO(): Server | null {
  return io;
}

/** 定向踢下线（封禁/禁言/移除成员/退出所有设备）：先下发 kicked 事件，再断开该用户全部连接 */
export function kickUser(userId: string, reason?: string) {
  if (!io) return;
  io.to(`user:${userId}`).emit('chat:kicked', { reason: reason || '账号状态变更' });
  io.in(`user:${userId}`).disconnectSockets(true);
}

/** 管理员软删消息后，实时通知会话双方移除该消息 */
export function emitMessageDeleted(conversationId: string, messageId: string) {
  if (!io) return;
  io.to(`conv:${conversationId}`).emit('chat:message-deleted', { messageId });
}

/** 校验 user 是否为会话参与者（求职者或企业有效成员）——chat:join/read/typing 防越权；返回 null 表示非参与者，返回对象供调用方检查 closed_at */
async function getConversationMembership(userId: string, conversationId: string) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [
        { candidate_id: userId },
        { company: { members: { some: { user_id: userId, status: 'ACTIVE' } } } },
      ],
    },
    select: { id: true, closed_at: true },
  });
}

/** 初始化 Socket.IO（Redis 多实例适配器 + JWT 认证 + 在线状态 + 消息事件） */
export async function initSocket(server: HttpServer) {
  if (io) return io;
  io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : true,
      credentials: true,
    },
  });

  // Redis Adapter：多实例消息广播（失败时退化为单机内存 adapter）
  try {
    const pub = await ensureRedis();
    const sub = pub.duplicate();
    await Promise.all([pub.ping(), sub.ping()]);
    io.adapter(createAdapter(pub, sub));
  } catch (e) {
    log('warn', 'socket:redis-adapter-unavailable', { error: (e as Error)?.message });
  }

  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth?.token as string) || '';
      const payload = await verifyAccessToken(token);
      if (!payload) return next(new Error('unauthorized'));
      const user = await prisma.user.findUnique({ where: { id: payload.uid } });
      if (!user || user.status !== 'ACTIVE') return next(new Error('unauthorized'));
      socket.data.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user as { id: string; chat_muted_until?: Date | null };
    // 加入个人房间（用于定向通知）
    socket.join(`user:${user.id}`);
    // 在线集合
    try {
      const r = await ensureRedis();
      await r.sadd('online:users', user.id);
      await r.expire('online:users', 3600);
      io?.emit('presence:update', await getOnlineCount());
    } catch {
      // ignore
    }

    socket.on('chat:send', async (payload: { conversationId: string; content: string }, ack) => {
      try {
        const cfg = await getSiteConfig();
        if (!cfg.chat_enabled) return ack?.({ ok: false, error: 'CHAT_DISABLED' });
        // 禁言校验（发送层二次拦截，防绕过）
        if (user.chat_muted_until && new Date(user.chat_muted_until) > new Date())
          return ack?.({ ok: false, error: 'MUTED' });
        // 聊天限流（每分钟 max 条）
        const allow = await rateLimit(`chat:${user.id}`, cfg.chat_rate_limit_per_min, 60);
        if (!allow) return ack?.({ ok: false, error: 'RATE_LIMITED' });
        if (!payload?.content?.trim() || payload.content.length > 500) return ack?.({ ok: false, error: 'INVALID' });

        const content = payload.content.trim();
        // 敏感词过滤（CHAT scope）
        const { sensitiveWordFilter } = await import('@/lib/sensitive/filter');
        if (await sensitiveWordFilter('CHAT', content)) return ack?.({ ok: false, error: 'SENSITIVE_WORD' });

        const conversation = await prisma.conversation.findFirst({
          where: { id: payload.conversationId, OR: [{ candidate_id: user.id }, { company: { members: { some: { user_id: user.id, status: 'ACTIVE' } } } }] },
          select: { id: true, candidate_id: true, company_id: true, closed_at: true },
        });
        if (!conversation) return ack?.({ ok: false, error: 'NOT_FOUND' });
        // 管理员已关闭的会话禁止继续发消息
        if (conversation.closed_at) return ack?.({ ok: false, error: 'CONVERSATION_CLOSED' });

        const message = await prisma.message.create({
          data: { conversation_id: conversation.id, sender_id: user.id, content },
        });
        await prisma.conversation.update({ where: { id: conversation.id }, data: { last_message_at: new Date() } });

        // 广播给会话双方（忽略发送者本人回显，由 ack 返回）
        socket.to(`conv:${conversation.id}`).emit('chat:message', message);
        // 发送者回执
        ack?.({ ok: true, message });

        // 未读通知给对方
        const isCandidate = conversation.candidate_id === user.id;
        const notifyUserId = isCandidate
          ? (await prisma.companyMember.findFirst({ where: { company_id: conversation.company_id, status: 'ACTIVE' } }))?.user_id
          : conversation.candidate_id;
        if (notifyUserId && notifyUserId !== user.id) {
          await notifyUser({
            userId: notifyUserId,
            type: 'NEW_MESSAGE',
            title: '收到新消息',
            body: content.slice(0, 50),
            // 发送方是求职者 → 对方为企业成员；反之对方为求职者
            link: isCandidate ? `/company/messages/${conversation.id}` : `/candidate/messages/${conversation.id}`,
          });
          io?.to(`user:${notifyUserId}`).emit('chat:unread', { conversationId: conversation.id });
        }
      } catch (e: any) {
        log('error', 'socket:chat-send-failed', { error: e?.message });
        ack?.({ ok: false, error: 'INTERNAL' });
      }
    });

    socket.on('chat:read', async ({ conversationId }: { conversationId: string }) => {
      const conv = await getConversationMembership(user.id, conversationId);
      if (!conversationId || !conv) return;
      // 先查出将被标记已读的消息 ID，再更新，最后广播给对方
      const unread = await prisma.message.findMany({
        where: { conversation_id: conversationId, sender_id: { not: user.id }, read_at: null },
        select: { id: true },
      });
      if (unread.length) {
        await prisma.message.updateMany({
          where: { conversation_id: conversationId, sender_id: { not: user.id }, read_at: null },
          data: { read_at: new Date() },
        });
        // 广播给会话房间（包括发送者自己，前端按 sender_id 过滤）
        io?.to(`conv:${conversationId}`).emit('chat:read', {
          conversationId,
          messageIds: unread.map((m) => m.id),
        });
      }
    });

    socket.on('chat:join', async ({ conversationId }: { conversationId: string }) => {
      if (!conversationId) return;
      // chat:join 仅验证参与权（不拦截已关闭会话，确保 chat:closed 事件能实时到达）
      const conv = await getConversationMembership(user.id, conversationId);
      if (!conv) return;
      socket.join(`conv:${conversationId}`);
    });

    socket.on('chat:typing', async ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      const conv = await getConversationMembership(user.id, conversationId);
      if (!conv || conv.closed_at) return;
      socket.to(`conv:${conversationId}`).emit('chat:typing', { userId: user.id, conversationId, isTyping });
    });

    socket.on('disconnect', async () => {
      try {
        const r = await ensureRedis();
        await r.srem('online:users', user.id);
        io?.emit('presence:update', await getOnlineCount());
      } catch {
        // ignore
      }
    });
  });

  return io;
}

export async function getOnlineCount(): Promise<number> {
  try {
    const r = await ensureRedis();
    return await r.scard('online:users');
  } catch {
    return 0;
  }
}
