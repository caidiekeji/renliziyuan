'use client';

import { DashboardShell, type NavItem } from '@/components/layout/DashboardShell';
import { candidateNav } from '@/lib/candidate-nav';

/** 求职者端移动底部 Tab（v2.8）：职位/小时工/消息/我的，固定四宫格等宽分布 */
export const CANDIDATE_MOBILE_TABS: NavItem[] = [
  { href: '/jobs', label: '职位', icon: 'job', match: '/jobs' },
  { href: '/hourly-jobs', label: '小时工', icon: 'clock', match: '/hourly-jobs' },
  { href: '/candidate/messages', label: '消息', icon: 'chat', match: '/candidate/messages', badge: 'unread' },
  { href: '/candidate', label: '我的', icon: 'user', match: '/candidate' },
];

/** 求职者区布局：桌面端左侧导航 + 移动端底部 Tab */
export function CandidateShell({
  sub,
  children,
}: {
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <DashboardShell nav={candidateNav} title="求职者中心" sub={sub} mobileTabs={CANDIDATE_MOBILE_TABS}>
      {children}
    </DashboardShell>
  );
}