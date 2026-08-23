'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { io, type Socket } from 'socket.io-client';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { PageLoading } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import type { ConversationItem } from '@/components/chat/ConversationList';

interface ChatMessage {
  id: string;
  conversation_id?: string;
  sender_id: string;
  content: string;
  read_at?: string | null;
  created_at: string;
}

interface Counterpart {
  name: string;
  avatar?: string | null;
  jobTitle?: string;
}

/**
 * 实时聊天窗口（求职者/企业共用）：
 * - 历史消息：GET /api/conversations/[id]/messages（游标逆序分页，滚动顶部加载更早）
 * - 实时：socket.io-client 同源连接，auth token 来自 /api/socket-token
 * - 事件：chat:join / chat:send(ack) / chat:message / 离开时 chat:read
 */
export function ChatWindow({
  conversationId,
  viewAs,
  backPath,
}: {
  conversationId: string;
  viewAs: 'candidate' | 'company';
  backPath: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [counterpart, setCounterpart] = useState<Counterpart>({
    name: viewAs === 'candidate' ? '企业' : '求职者',
  });
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<string | null>(null);
  const myId = user?.id;
  const [typing, setTyping] = useState(false);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // 对方信息（会话列表接口不含单会话详情，从列表匹配）
  useEffect(() => {
    api.get<ConversationItem[]>('/api/conversations' + qs({ pageSize: 50 })).then((r) => {
      if (!r.ok) return;
      const found = r.data.find((c) => c.id === conversationId);
      if (found) {
        setCounterpart({
          name: viewAs === 'candidate' ? found.company?.name || '企业' : found.candidate?.name || '求职者',
          avatar: viewAs === 'candidate' ? found.company?.logo : found.candidate?.avatar,
          jobTitle: found.job?.title,
        });
      }
    });
  }, [conversationId, viewAs]);

  // 历史消息 + 实时 socket
  useEffect(() => {
    let disposed = false;
    let socket: Socket | null = null;

    const loadHistory = async () => {
      const r = await api.get<ChatMessage[]>(
        `/api/conversations/${conversationId}/messages` + qs({ pageSize: 30 })
      );
      if (disposed) return;
      if (r.ok) {
        setMessages(r.data);
        cursorRef.current = r.data[0]?.created_at || null;
        setHasMore(Boolean(r.meta?.hasMore));
      }
      setLoading(false);
      requestAnimationFrame(scrollToBottom);
    };

    const initSocket = async () => {
      const t = await api.get<{ token: string }>('/api/socket-token');
      if (disposed || !t.ok) return;
      socket = io({ path: '/socket.io', auth: { token: t.data.token } });
      socketRef.current = socket;
      socket.on('connect', () => {
        socket?.emit('chat:join', { conversationId });
      });
      socket.on('chat:message', (msg: ChatMessage) => {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        const el = scrollRef.current;
        if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) requestAnimationFrame(scrollToBottom);
      });
      // 管理员软删消息：实时移除
      socket.on('chat:message-deleted', ({ messageId }: { messageId: string }) => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      });
      // 对方正在输入
      socket.on('chat:typing', ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
        if (userId !== myId) setTyping(Boolean(isTyping));
      });
      // 被踢下线（封禁/禁言/移除成员/退出所有设备）
      socket.on('chat:kicked', ({ reason }: { reason?: string }) => {
        toast('error', reason || '连接已断开');
        socket?.disconnect();
        socketRef.current = null;
      });
    };

    loadHistory();
    initSocket();

    return () => {
      disposed = true;
      if (socket) {
        socket.emit('chat:read', { conversationId });
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [conversationId, toast, myId]);

  // 顶部滚动加载更早消息
  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    const cursor = cursorRef.current;
    const r = await api.get<ChatMessage[]>(
      `/api/conversations/${conversationId}/messages` + qs({ cursor, pageSize: 30 })
    );
    if (r.ok && r.data.length) {
      const el = scrollRef.current;
      const prevHeight = el?.scrollHeight || 0;
      setMessages((prev) => [...r.data, ...prev]);
      cursorRef.current = r.data[0]?.created_at || null;
      setHasMore(Boolean(r.meta?.hasMore));
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    }
    setLoadingMore(false);
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (el && el.scrollTop < 40) loadMore();
  };

  const send = () => {
    const content = draft.trim();
    if (!content) return;
    const socket = socketRef.current;
    if (!socket) {
      toast('error', '连接异常，请刷新重试');
      return;
    }
    setDraft('');
    socket.emit('chat:send', { conversationId, content }, (ack: any) => {
      if (ack?.ok && ack.message) {
        setMessages((prev) => (prev.some((m) => m.id === ack.message.id) ? prev : [...prev, ack.message]));
        requestAnimationFrame(scrollToBottom);
      } else {
        toast('error', ack?.error === 'RATE_LIMITED' ? '发送太频繁，请稍后再试' : ack?.error === 'CHAT_DISABLED' ? '站内沟通已关闭' : ack?.error === 'MUTED' ? '你已被禁言，暂不能发送消息' : '发送失败，请重试');
      }
    });
  };

  return (
    <div className="flex h-[100dvh] w-full justify-center bg-bg-subtle lg:py-6 lg:px-4">
      <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white lg:rounded-xl lg:border lg:border-border lg:shadow-sm">
        {/* 顶部：返回 + 对方信息 */}
        <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border bg-white px-3">
          <Link
            href={backPath}
            className="flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-sm text-text-secondary hover:bg-bg-subtle hover:text-text"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            返回
          </Link>
          {counterpart.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={counterpart.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-text">
              {(counterpart.name || '?').slice(0, 1)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{counterpart.name}</p>
            {counterpart.jobTitle && <p className="truncate text-xs text-text-secondary">{counterpart.jobTitle}</p>}
          </div>
        </header>

        {/* 消息流 */}
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-2 overflow-y-auto bg-bg-subtle px-3 py-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <PageLoading />
            </div>
          ) : messages.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-secondary">暂无消息，打个招呼吧</p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === myId;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 sm:max-w-[65%] ${
                      mine ? 'rounded-br-md bg-primary-soft' : 'rounded-bl-md border border-border bg-white'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm text-text">{m.content}</p>
                    <div className={`mt-0.5 flex items-center gap-1.5 text-[10px] text-text-secondary ${mine ? 'justify-end' : ''}`}>
                      {mine && <span className={m.read_at ? 'text-accent' : ''}>{m.read_at ? '已读' : '未读'}</span>}
                      <span>{formatDateTime(m.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {loadingMore && (
            <div className="flex justify-center py-1">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>

        {/* 底部输入 */}
        <footer className="shrink-0 border-t border-border bg-white p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                socketRef.current?.emit('chat:typing', { conversationId, isTyping: e.target.value.trim().length > 0 });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="输入消息…"
              rows={1}
              className="max-h-28 flex-1 resize-none rounded-lg border border-border bg-bg-subtle px-3 py-2 text-sm text-text placeholder:text-text-secondary/50 focus:border-text-secondary"
            />
            <Button onClick={send} disabled={!draft.trim()}>
              发送
            </Button>
          </div>
          {typing && <p className="mt-1 text-xs text-text-secondary">对方正在输入…</p>}
        </footer>
      </div>
    </div>
  );
}
