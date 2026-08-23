import type { NavItem } from '@/components/layout/DashboardShell';

/** 求职者区左侧导航（DashboardShell nav） */
export const candidateNav: NavItem[] = [
  { href: '/candidate', label: '个人中心', icon: 'user' },
  { href: '/candidate/seekers', label: '我的求职信息', icon: 'doc' },
  { href: '/candidate/favorites', label: '我的收藏', icon: 'star' },
  { href: '/candidate/hourly-jobs', label: '我的小时工', icon: 'clock' },
  { href: '/candidate/messages', label: '消息', icon: 'chat' },
  { href: '/candidate/profile', label: '编辑资料', icon: 'settings' },
];
