'use client';

import { useEffect, useState } from 'react';

/** 验证码发送倒计时（60s），登录/找回密码等页面共用 */
export function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [left]);
  return { left, start: () => setLeft(60) };
}
