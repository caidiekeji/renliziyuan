'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSiteConfig } from '@/components/layout/SiteConfigProvider';

export interface NavItem {
  href: string;
  label: string;
  icon?: string;
  /** 匹配前缀（默认与 href 相同） */
  match?: string;
  /** 底部 Tab 未读角标：unread 时显示当前用户未读消息数 */
  badge?: 'unread';
}

/** 线性一致笔触的图标集（内部使用） */
function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
    job: 'M21 13.3V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7.3M21 13.3a2 2 0 0 1-2 1.7h-3l-2 3h-4l-2-3H5a2 2 0 0 1-2-1.7M21 13.3V9M3 13.3V9',
    chat: 'M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z',
    star: 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
    users: 'M16 11a3 3 0 1 0 0-6m2 13c0-2.2-1.8-4-4-4H6c-2.2 0-4 1.8-4 4m18-3c0-2-1.5-3.6-3.4-3.9M8 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16m-12 0h16m-6 0V9h4v12',
    card: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm0 4h18',
    chart: 'M4 20V10m6 10V4m6 16v-7m4 7V8',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.6 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
    doc: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6',
    shield: 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Z',
    bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9m6 11a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2Z',
    map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
    lock: 'M6 11V8a6 6 0 1 1 12 0v3m-9 0h6l1 9H5l1-9Zm3 4v2',
    send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
    exit: 'M15 12H3m0 0 4-4m-4 4 4 4m9 5h3a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3',
    clock: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  };
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || paths.doc} />
    </svg>
  );
}

/** 侧栏导航主体：标题 + 导航项 + 底部（返回首页 / 当前用户）。桌面与移动端抽屉共用 */
function SidebarNav({
  nav,
  isActive,
  title,
  sub,
  collapsed = false,
}: {
  nav: NavItem[];
  isActive: (item: NavItem) => boolean;
  title: string;
  sub?: string;
  collapsed?: boolean;
}) {
  const { user } = useAuth();
  return (
    <div className="flex h-full flex-col">
      {!collapsed && (
        <div className="px-3 pb-2 pt-1">
          <p className="text-sm font-semibold text-text">{title}</p>
          {sub && <p className="mt-0.5 text-xs text-text-secondary">{sub}</p>}
        </div>
      )}
      <nav className="flex flex-1 flex-col gap-0.5">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            title={collapsed ? item.label : undefined}
            className={`flex items-center rounded-lg py-2 text-sm transition-colors duration-150 ${
              collapsed ? 'justify-center' : 'gap-2.5 px-3'
            } ${
              isActive(item)
                ? 'bg-primary-soft text-primary font-medium'
                : 'text-text-secondary hover:bg-bg-subtle hover:text-text'
            }`}
          >
            <Icon name={item.icon || 'doc'} />
            {!collapsed && item.label}
          </Link>
        ))}
      </nav>

      <div className={`mt-6 border-t border-border pt-3 ${collapsed ? 'px-0' : 'px-3'}`}>
        <div
          className={`mb-1 flex items-center rounded-lg py-1.5 text-xs text-text-secondary ${
            collapsed ? 'justify-center' : 'gap-2 px-3'
          }`}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft font-semibold text-text">
            {(user?.name || '?').slice(0, 1)}
          </span>
          {!collapsed && <span className="min-w-0 flex-1 truncate">{user?.name}</span>}
        </div>
        <Link
          href="/"
          title={collapsed ? '返回首页' : undefined}
          className={`flex items-center rounded-lg py-2 text-sm text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text ${
            collapsed ? 'justify-center' : 'gap-2.5 px-3'
          }`}
        >
          <Icon name="exit" />
          {!collapsed && <>返回首页</>}
        </Link>
      </div>
    </div>
  );
}

export function DashboardShell({
  nav,
  title,
  sub,
  children,
  activeMatch,
  mobileTabs,
}: {
  nav: NavItem[];
  title: string;
  sub?: string;
  children: React.ReactNode;
  activeMatch?: string;
  /** 移动端底部 Tab（如求职者端「职位/小时工/消息/我的」）；不传则移动端用抽屉侧栏 */
  mobileTabs?: NavItem[];
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { siteName, siteLogo } = useSiteConfig();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (item: NavItem) => pathname.startsWith(item.match || activeMatch || item.href);

  /** 底部 Tab 激活态：取最长前缀匹配（解决「消息 /candidate/messages」与「我的 /candidate」重叠） */
  const isMobileTabActive = (item: NavItem): boolean => {
    const href = item.match || item.href;
    const hasLonger = (mobileTabs || []).some((x) => {
      const m = x.match || x.href;
      return m !== href && m.length > href.length && pathname.startsWith(m);
    });
    return pathname.startsWith(href) && !hasLonger;
  };

  return (
    <div className="flex min-h-screen bg-bg-subtle">
      {/* 侧栏（桌面）: 贴左全高、固定于视口、内部独立滚动，可折叠 */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-border bg-white transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-screen ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className={`flex h-16 shrink-0 items-center gap-2 border-b border-border ${collapsed ? 'justify-center px-2' : 'px-3'}`}>
          {!collapsed &&
            (siteLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={siteLogo} alt={siteName} className="h-8 w-8 shrink-0 rounded-lg object-contain" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">{siteName.slice(0, 1)}</span>
            ))
          }
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate text-base font-bold text-text">{siteName}</span>
          )}
          {/* 折叠/展开开关 */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
            title={collapsed ? '展开侧栏' : '折叠侧栏'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text"
          >
            {collapsed ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            )}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav nav={nav} isActive={isActive} title={title} sub={sub} collapsed={collapsed} />
        </div>
      </aside>

      {/* 右侧主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 移动端顶部栏 */}
        <div className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-white px-4 lg:hidden">
          {mobileTabs ? (
            <span className="w-6 shrink-0" />
          ) : (
            <button onClick={() => setMobileOpen(true)} className="text-text" aria-label="打开菜单">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold">{title}</p>
            {sub && <p className="truncate text-xs text-text-secondary">{sub}</p>}
          </div>
          <Link href="/" className="text-xs shrink-0 text-text-secondary">返回首页</Link>
        </div>

        {/* 移动端抽屉 */}
        {mobileOpen && (
          <div className="fixed inset-0 z-20 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-64 bg-white p-3 shadow-xl">
              <SidebarNav nav={nav} isActive={isActive} title={title} sub={sub} />
            </div>
          </div>
        )}

        {/* 桌面顶部栏：用户操作 */}
        <header className="sticky top-0 z-40 hidden h-16 shrink-0 items-center justify-end border-b border-border bg-white px-6 lg:flex">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs text-text-secondary transition-colors hover:text-text">返回前台</Link>
            <span className="flex items-center gap-2 text-sm text-text">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft font-semibold text-text">
                {(user?.name || '?').slice(0, 1)}
              </span>
              <span className="max-w-28 truncate">{user?.name}</span>
            </span>
            <button onClick={() => logout()} className="text-xs text-text-secondary transition-colors hover:text-danger">
              退出登录
            </button>
          </div>
        </header>

        {/* 内容区 */}
        <main className={`flex-1 px-5 pt-6 sm:px-8 lg:px-10 ${mobileTabs ? 'pb-24 lg:pb-10' : 'pb-6'}`}>
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        {/* 移动端底部 Tab（仅当传入 mobileTabs 时展示） */}
        {mobileTabs && (
          <nav
            className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white lg:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex h-14">
              {mobileTabs.map((t) => {
                const active = isMobileTabActive(t);
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    prefetch={false}
                    className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
                      active ? 'font-semibold text-primary' : 'text-text-secondary'
                    }`}
                  >
                    <span className="relative">
                      <Icon name={t.icon || 'doc'} />
                      {t.badge === 'unread' && (user?.unread || 0) > 0 && (
                        <span className="absolute -right-2.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
                          {(user?.unread || 0) > 99 ? '99+' : user?.unread}
                        </span>
                      )}
                    </span>
                    <span>{t.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}