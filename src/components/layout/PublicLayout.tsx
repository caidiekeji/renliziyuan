'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, qs } from '@/lib/api';
import { useSiteConfig } from '@/components/layout/SiteConfigProvider';
import { useAutoCityContext } from '@/components/layout/AutoCityProvider';

interface City {
  id: string;
  province: string;
  name: string;
}

export function CitySwitcher({ current, locating }: { current: string; locating?: boolean }) {
  return (
    <Suspense fallback={null}>
      <CitySwitcherInner current={current} locating={locating} />
    </Suspense>
  );
}

function CitySwitcherInner({ current, locating }: { current: string; locating?: boolean }) {
  const [open, setOpen] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [keyword, setKeyword] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    if (open) {
      api.get<City[]>('/api/cities').then((r) => r.ok && setCities(r.data));
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // 点击面板外部 / 按 Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const grouped = useMemo(() => {
    const k = keyword.trim();
    const list = k ? cities.filter((c) => c.name.includes(k) || c.province.includes(k)) : cities;
    const map = new Map<string, City[]>();
    list.forEach((c) => {
      if (!map.has(c.province)) map.set(c.province, []);
      map.get(c.province)!.push(c);
    });
    return [...map.entries()];
  }, [cities, keyword]);

  const select = (city: string) => {
    setOpen(false);
    const params = new URLSearchParams(sp.toString());
    if (city === '全国' || !city) params.delete('city');
    else params.set('city', city);
    router.push(`?${params.toString()}`);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-subtle hover:text-text"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 21s-7-5.1-7-11a7 7 0 1 1 14 0c0 5.9-7 11-7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        {locating ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            定位中…
          </span>
        ) : (
          <span className="max-w-24 truncate">{current || '全国'}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-white shadow-lg">
          <div className="border-b border-border p-3">
            <input
              ref={inputRef}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索城市…"
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm transition-colors duration-200 hover:border-text-secondary/40"
            />
            <div className="mt-2">
              <button
                onClick={() => select('全国')}
                className={`rounded-md px-2.5 py-1 text-sm ${current === '全国' || !current ? 'bg-primary-soft text-text' : 'text-text-secondary hover:bg-bg-subtle'}`}
              >
                全国
              </button>
            </div>
          </div>
          <div className="max-h-72 space-y-4 overflow-y-auto p-3">
            {grouped.map(([prov, list]) => (
              <div key={prov}>
                <p className="mb-1.5 text-xs font-semibold text-text-secondary">{prov}</p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => select(c.name)}
                      className={`rounded-md px-2.5 py-1 text-sm ${
                        current === c.name ? 'bg-primary-soft text-text' : 'text-text hover:bg-bg-subtle'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {grouped.length === 0 && <p className="py-8 text-center text-sm text-text-secondary">未找到匹配城市</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function PublicHeader() {
  return (
    <Suspense fallback={null}>
      <PublicHeaderInner />
    </Suspense>
  );
}

function PublicHeaderInner() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const { siteName, siteLogo, nav } = useSiteConfig();
  const { locatedCity, done: locateDone } = useAutoCityContext();
  const city = sp.get('city') || '全国';
  const hasCityParam = sp.has('city');
  const displayCity = hasCityParam ? city : locatedCity || '全国';
  const locating = !hasCityParam && !locateDone;

  // 自动定位成功且 URL 未显式指定城市时，回填城市参数
  useEffect(() => {
    if (locateDone && locatedCity && !hasCityParam) {
      const p = new URLSearchParams(sp.toString());
      p.set('city', locatedCity);
      router.replace(`?${p.toString()}`);
    }
  }, [locateDone, locatedCity, hasCityParam, router, sp]);

  const roleHome = user?.role === 'ADMIN' ? '/adminli' : user?.role === 'COMPANY' ? '/company' : '/candidate';

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-1.5">
            {siteLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={siteLogo} alt={siteName} className="h-7 w-7 rounded-lg object-contain" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">{siteName.slice(0, 1)}</span>
            )}
            <span className="text-base font-bold text-text">
              {siteName}
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href + qs({ city: city !== '全国' ? city : undefined })}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 ${pathname.startsWith(n.href) ? 'bg-primary-soft font-medium text-text' : 'text-text-secondary hover:bg-bg-subtle hover:text-text'}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <CitySwitcher current={displayCity} locating={locating} />
          {user ? (
            <>
              {user.role === 'ADMIN' ? (
                <span className="hidden items-center gap-2 rounded-lg px-2 py-1.5 text-sm sm:flex">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-text">
                    {user.name.slice(0, 1)}
                  </span>
                  <span className="max-w-24 truncate">{user.name}</span>
                </span>
              ) : (
                <Link
                  href={roleHome}
                  className="hidden items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-bg-subtle sm:flex"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-text">
                    {user.name.slice(0, 1)}
                  </span>
                  <span className="max-w-24 truncate">{user.name}</span>
                </Link>
              )}
              {user.role !== 'ADMIN' && (
                <Link
                  href={roleHome}
                  className="rounded-lg bg-primary-soft px-3 py-1.5 text-sm font-medium text-text hover:bg-primary-soft-hover"
                >
                  {user.role === 'COMPANY' ? '企业工作台' : '个人中心'}
                </Link>
              )}
              <button onClick={() => logout()} className="text-sm text-text-secondary hover:text-text">
                退出
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-subtle hover:text-text">
                登录
              </Link>
              <Link href="/register" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover">
                注册
              </Link>
            </>
          )}
        </div>
      </div>
      {/* 移动端导航 */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-1 md:hidden">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href + qs({ city: city !== '全国' ? city : undefined })}
            className={`shrink-0 rounded-lg px-3 py-1 text-sm transition-colors duration-200 ${pathname.startsWith(n.href) ? 'bg-primary-soft font-medium text-text' : 'text-text-secondary'}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

/** 移动端固定底部 Tab 栏：职位/小时工/消息/我的（与 CandidateShell 一致） */
export function PublicBottomBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const tabs = [
    { href: '/jobs', label: '职位', icon: 'M21 13.3V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7.3M21 13.3a2 2 0 0 1-2 1.7h-3l-2 3h-4l-2-3H5a2 2 0 0 1-2-1.7M21 13.3V9M3 13.3V9' },
    { href: '/hourly-jobs', label: '小时工', icon: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { href: '/candidate/messages', label: '消息', icon: 'M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z' },
    { href: '/candidate', label: '我的', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0' },
  ];

  const isActive = (href: string) => {
    if (href === '/candidate') {
      // 最长前缀匹配，避免 /candidate/messages 同时激活「我的」
      const hasLonger = tabs.some((t) => t.href !== href && t.href.length > href.length && pathname.startsWith(t.href));
      return pathname.startsWith(href) && !hasLonger;
    }
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-14">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            prefetch={false}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
              isActive(t.href) ? 'font-semibold text-primary' : 'text-text-secondary'
            }`}
          >
            <span className="relative">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={t.icon} />
              </svg>
              {t.href === '/candidate/messages' && user && (user.unread || 0) > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
                  {(user.unread || 0) > 99 ? '99+' : user.unread}
                </span>
              )}
            </span>
            <span>{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function PublicFooter() {
  const { siteName, nav } = useSiteConfig();
  return (
    <footer className="mt-12 border-t border-border bg-bg-subtle pb-16 lg:pb-0">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3">
        <div>
          <p className="mb-2 text-sm font-semibold text-text">{siteName}</p>
          <p className="text-xs leading-relaxed text-text-secondary">连接企业与人才的桥梁，让招聘更简单、更高效。</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-text">快速链接</p>
          <div className="flex flex-col gap-1.5 text-xs text-text-secondary">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-text">{n.label}</Link>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-text">协议条款</p>
          <div className="flex flex-col gap-1.5 text-xs text-text-secondary">
            <Link href="/register-agreement" className="hover:text-text">注册须知</Link>
            <Link href="/terms" className="hover:text-text">使用须知</Link>
            <Link href="/privacy" className="hover:text-text">隐私政策</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-text-secondary">
        © {new Date().getFullYear()} {siteName} · 招聘求职服务平台
      </div>
      <PublicBottomBar />
    </footer>
  );
}
