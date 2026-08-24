/** 薪资格式化 */
export function formatSalary(salaryMin?: number | null, salaryMax?: number | null, unit?: string | null): string {
  if (salaryMin == null || salaryMax == null) return '面议';
  if (unit === 'DAY_YUAN') return `${salaryMin}-${salaryMax}元/天`;
  if (unit === 'HOUR_YUAN') return `${salaryMin}-${salaryMax}元/小时`;
  return `${salaryMin}-${salaryMax}K`;
}

export function formatDate(d?: string | Date | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '-';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateTime(d?: string | Date | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '-';
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function timeAgo(d?: string | Date | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '-';
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return formatDate(date);
}

export function formatKm(km?: number | null): string {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

/** 头像首字 */
export function initialOf(name?: string | null): string {
  return (name || '?').slice(0, 1).toUpperCase();
}

export const JOB_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: '全职',
  PART_TIME: '兼职',
  INTERN: '实习',
  CONTRACT: '合同工',
};

export const EXPERIENCE_LABEL: Record<string, string> = {
  FRESH: '应届',
  Y1_3: '1-3年',
  Y3_5: '3-5年',
  Y5: '5年以上',
};

export const ROLE_LABEL: Record<string, string> = {
  CANDIDATE: '求职者',
  COMPANY: '企业',
  ADMIN: '管理员',
};

export const USER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: '正常',
  BANNED: '已封禁',
  DELETED: '已注销',
};

export const COMPANY_VERIFY_LABEL: Record<string, string> = {
  PENDING: '待审核',
  VERIFIED: '已认证',
  REJECTED: '已驳回',
};

export const JOB_STATUS_LABEL: Record<string, string> = {
  OPEN: '在招',
  CLOSED: '已下线',
};

export const AUDIT_STATUS_LABEL: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
};

export const SUB_STATUS_LABEL: Record<string, string> = {
  ACTIVE: '生效中',
  EXPIRED: '已过期',
  CANCELLED: '已取消',
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: '待支付',
  PAID: '已支付',
  FAILED: '失败',
  REFUNDED: '已退款',
};

export const REPORT_STATUS_LABEL: Record<string, string> = {
  PENDING: '待处理',
  HANDLED: '已处理',
  DISMISSED: '已驳回',
};
