'use client';

import { useEffect } from 'react';

const INTERVAL = 120_000; // 每 2 分钟心跳一次（在线窗口 10 分钟，余量充足）

/** 复用 PageTracker 的 session_id，保证会话一致 */
function getSessionId(): string {
  try {
    let sid = window.localStorage.getItem('jobbridge_session_id');
    if (!sid) {
      sid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem('jobbridge_session_id', sid);
    }
    return sid;
  } catch {
    return '';
  }
}

/**
 * 在线心跳：页面可见期间周期性上报活跃状态。
 * 页面隐藏/切后台时停止，重新可见时立即上报（fire-and-forget，失败不影响主流程）。
 */
export function Heartbeat() {
  useEffect(() => {
    const send = () => {
      const sessionId = getSessionId();
      if (!sessionId) return;
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ session_id: sessionId }),
      }).catch(() => undefined);
    };
    let timer: number | null = null;
    const start = () => {
      if (timer !== null) return;
      send(); // 立即上报一次
      timer = window.setInterval(send, INTERVAL);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
