'use client';

import { createContext, useContext } from 'react';

export interface SiteNav {
  id: string;
  label: string;
  href: string;
  sort: number;
}

export interface SiteConfig {
  siteName: string;
  siteLogo: string;
  nav: SiteNav[];
}

/**
 * 由根布局（Server）从 site_config / nav_menu 表注入，
 * 供前台 Header/Footer 与后台框架等 Client 组件统一读取，避免硬编码站点名、Logo 与导航。
 */
const Ctx = createContext<SiteConfig>({ siteName: '', siteLogo: '', nav: [] });

export function SiteConfigProvider({
  siteName,
  siteLogo,
  nav,
  children,
}: {
  siteName: string;
  siteLogo: string;
  nav: SiteNav[];
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={{ siteName, siteLogo, nav }}>{children}</Ctx.Provider>;
}

export function useSiteConfig(): SiteConfig {
  return useContext(Ctx);
}