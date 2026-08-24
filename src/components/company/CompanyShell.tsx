'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell, type NavItem } from '@/components/layout/DashboardShell';
import { PageLoading } from '@/components/ui/Spinner';
import { useMyCompanies, COMPANY_ROLE_LABEL } from '@/lib/company';

/** 企业区左侧导航 */
export const COMPANY_NAV: NavItem[] = [
  { href: '/company', label: '工作台', icon: 'home' },
  { href: '/company/jobs', label: '职位管理', icon: 'job' },
  { href: '/company/jobs/new', label: '发布职位', icon: 'send' },
  { href: '/company/messages', label: '消息', icon: 'chat', badge: 'unread' },
  { href: '/company/reviews', label: '评价', icon: 'star' },
  { href: '/company/hourly-jobs', label: '小时工管理', icon: 'clock' },
  { href: '/company/boosts', label: '竞价置顶', icon: 'chart' },
  { href: '/company/wallet', label: '企业钱包', icon: 'card' },
  { href: '/company/profile', label: '企业资料', icon: 'building' },
  { href: '/company/members', label: '成员管理', icon: 'users' },
  { href: '/company/billing', label: '会员与账单', icon: 'card' },
];

/** 企业区移动底部 Tab：工作台/发布职位/消息/企业中心，覆盖企业核心高频操作 */
export const COMPANY_MOBILE_TABS: NavItem[] = [
  { href: '/company', label: '工作台', icon: 'home', match: '/company' },
  { href: '/company/jobs', label: '发布职位', icon: 'send', match: '/company/jobs' },
  { href: '/company/messages', label: '消息', icon: 'chat', match: '/company/messages', badge: 'unread' },
  { href: '/company/profile', label: '企业中心', icon: 'user', match: '/company/profile' },
];

/** 企业区布局：左侧导航 + 顶部显示当前企业名（读 /api/companies/me 按 companyId 匹配） */
export function CompanyShell({ children }: { children: React.ReactNode }) {
  const { current } = useMyCompanies();
  return (
    <DashboardShell
      nav={COMPANY_NAV}
      title={current?.company.name || '企业中心'}
      sub={current ? COMPANY_ROLE_LABEL[current.role] || current.role : '请先选择企业'}
      mobileTabs={COMPANY_MOBILE_TABS}
    >
      {children}
    </DashboardShell>
  );
}

/** 企业上下文守卫：非企业成员（无企业 / 未选择企业）跳转切换页 */
export function CompanyGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { entries, current, loading } = useMyCompanies();

  useEffect(() => {
    if (loading) return;
    if (entries.length === 0 || !current) router.replace('/company/switch');
  }, [loading, entries, current, router]);

  if (loading || !current) return <PageLoading />;
  return <>{children}</>;
}
