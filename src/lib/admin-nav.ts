import type { NavItem } from '@/components/layout/DashboardShell';

/**
 * 管理后台左侧导航（图标为 DashboardShell 内置集合）。
 * match 默认取 href 前缀；子页面按各自路由自动高亮。
 */
export const ADMIN_NAV: NavItem[] = [
  { href: '/adminli', label: '首页', icon: 'home' },
  { href: '/adminli/users', label: '用户', icon: 'user' },
  { href: '/adminli/companies', label: '企业', icon: 'building' },
  { href: '/adminli/jobs', label: '职位', icon: 'job' },
  { href: '/adminli/messages', label: '消息', icon: 'chat' },
  { href: '/adminli/reviews', label: '评价', icon: 'star' },
  { href: '/adminli/billing', label: '计费', icon: 'card' },
  { href: '/adminli/boosts', label: '竞价置顶', icon: 'chart' },
  { href: '/adminli/hourly-jobs', label: '小时工', icon: 'clock' },
  { href: '/adminli/wallets', label: '企业余额', icon: 'card' },
  // 以下页面按 123.txt 规划，尚未创建（后续迭代补齐）
  { href: '/adminli/payment-settings', label: '支付设置', icon: 'lock' },
  { href: '/adminli/sms-settings', label: '短信设置', icon: 'bell' },
  { href: '/adminli/recommend', label: '推荐运营', icon: 'chart' },
  { href: '/adminli/cities', label: '城市库', icon: 'map' },
  { href: '/adminli/industries', label: '行业管理', icon: 'doc' },
  { href: '/adminli/job-titles', label: '职位名称', icon: 'job' },
  { href: '/adminli/content', label: '运营内容', icon: 'doc' },
  { href: '/adminli/config', label: '全局配置', icon: 'settings' },
  { href: '/adminli/columns', label: '栏目管理', icon: 'doc' },
  { href: '/adminli/analytics', label: '数据分析', icon: 'chart' },
  { href: '/adminli/reports', label: '举报中心', icon: 'shield' },
  { href: '/adminli/audit', label: '操作审计', icon: 'clock' },
  { href: '/adminli/export', label: '报表导出', icon: 'send' },
  { href: '/adminli/backup', label: '数据备份', icon: 'shield' },
  { href: '/adminli/policies', label: '条款协议', icon: 'doc' },
];
