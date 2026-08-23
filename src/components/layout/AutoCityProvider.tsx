'use client';

import { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { useAutoCity } from '@/lib/use-auto-city';

/** 后台/工作台等不需要城市定位的路径前缀 */
const SKIP_PREFIXES = ['/adminli', '/company', '/candidate'];

interface AutoCityState {
  locatedCity: string | null;
  done: boolean;
}

const Ctx = createContext<AutoCityState>({ locatedCity: null, done: false });

/**
 * 前台自动定位（浏览器 geolocation，失败走 IP 兜底，见 useAutoCity）。
 * 挂在根布局，页面级路由切换不重挂，只定位一次；后台路径跳过。
 */
export function AutoCityProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const enabled = !SKIP_PREFIXES.some((p) => pathname.startsWith(p));
  const { city: locatedCity, done } = useAutoCity(enabled);
  return <Ctx.Provider value={{ locatedCity, done }}>{children}</Ctx.Provider>;
}

export function useAutoCityContext(): AutoCityState {
  return useContext(Ctx);
}
