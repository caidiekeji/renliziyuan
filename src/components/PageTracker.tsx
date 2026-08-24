'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

let cachedCoords: { lat: number; lng: number } | null = null;

/** 模块级初始化：只执行一次，避免 Strict Mode 下 effect 双重执行导致生成多个 session_id */
function getOrCreateSessionId(): string {
  try {
    let sid = window.localStorage.getItem('jobbridge_session_id');
    if (!sid) {
      sid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem('jobbridge_session_id', sid);
    }
    return sid;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** 上报路由变更埋点（fire-and-forget，metrics 失败不影响主流程） */
export function PageTracker() {
  const pathname = usePathname();
  const sessionRef = useRef<string>('');
  const enterRef = useRef<number>(Date.now());

  useEffect(() => {
    sessionRef.current = getOrCreateSessionId();
  }, []);

  useEffect(() => {
    const sessionId = sessionRef.current || getOrCreateSessionId();
    const now = Date.now();
    const duration = Math.max(1, now - enterRef.current);
    enterRef.current = now;

    const body: Record<string, unknown> = {
      session_id: sessionId,
      path: pathname,
      referer: document.referrer || null,
      duration_ms: duration,
    };
    if (cachedCoords) {
      body.lat = cachedCoords.lat;
      body.lng = cachedCoords.lng;
      void report(body);
    } else {
      // 首次上报附带定位（仅成功一次，避免重复弹窗）
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              cachedCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              body.lat = cachedCoords.lat;
              body.lng = cachedCoords.lng;
              void report(body);
            },
            () => void report(body),
            { timeout: 4000, maximumAge: 600000 }
          );
        } else {
          void report(body);
        }
      } catch {
        void report(body);
      }
    }
  }, [pathname]);

  return null;
}

function report(body: Record<string, unknown>) {
  fetch('/api/page-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  }).catch(() => undefined);
}