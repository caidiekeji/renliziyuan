'use client';

import { useEffect, useState } from 'react';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/* ============ 企业区共享类型与工具（客户端） ============ */

export interface CompanySummary {
  id: string;
  name: string;
  logo?: string | null;
  verify_status: string;
  /** Prisma Decimal 可能以字符串序列化 */
  avg_rating?: number | string | null;
  review_count?: number;
  industry?: { id: string; name: string } | null;
}

export interface MyCompanyEntry {
  company: CompanySummary;
  role: string; // OWNER | HR | VIEWER
  status: string; // ACTIVE | INVITED
  subscription: {
    id: string;
    status: string;
    start_at: string;
    end_at: string;
    plan: { id: string; name: string; job_limit: number; can_feature: boolean; can_view_contacts: boolean };
  } | null;
  open_job_count: number;
}

/** GET /api/subscriptions 返回值 */
export interface SubscriptionInfo {
  subscription: {
    id: string;
    status: string;
    start_at: string;
    end_at: string;
    plan: { id: string; name: string; job_limit: number; can_feature: boolean; can_view_contacts: boolean };
  } | null;
  open_job_count: number;
}

export interface JobItem {
  id: string;
  company_id?: string;
  title: string;
  description: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_unit?: string | null;
  city?: string | null;
  industry_id?: string | null;
  job_title_id?: string | null;
  job_type?: string | null;
  experience?: string | null;
  education?: string | null;
  tags?: string[];
  status: string;
  closed_reason?: string | null;
  audit_status: string;
  is_featured?: boolean;
  is_hourly?: boolean;
  hourly_rate?: number | string | null;
  work_period?: string | null;
  slots?: number | null;
  applied_count?: number | null;
  lat?: number | string | null;
  lng?: number | string | null;
  views?: number;
  created_at?: string;
  updated_at?: string;
  industry?: { id: string; name: string } | null;
  job_title?: { id: string; name: string; category?: string } | null;
}

export interface CompanyDetail {
  id: string;
  name: string;
  logo?: string | null;
  industry_id?: string | null;
  size?: string | null;
  location?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  description?: string | null;
  founded_at?: string | null;
  verify_status: string;
  avg_rating?: number | string | null;
  review_count?: number;
  industry?: { id: string; name: string } | null;
  jobs?: JobItem[];
}

export interface MemberItem {
  id: string;
  company_id: string;
  user_id: string;
  role: string;
  status: string;
  created_at?: string;
  user: { id: string; name: string; avatar?: string | null; phone?: string | null };
}

export interface Plan {
  id: string;
  name: string;
  price_monthly?: number | string | null;
  price_yearly?: number | string | null;
  job_limit: number;
  can_feature: boolean;
  can_view_contacts: boolean;
  duration_days: number;
  active: boolean;
}

export interface PaymentItem {
  id: string;
  order_no: string;
  company_id: string;
  plan_id: string | null; // 充值订单 plan_id 为 null
  amount: number | string;
  channel: string;
  status: string;
  paid_at?: string | null;
  note?: string | null;
  created_at: string;
  plan?: { id: string; name: string } | null;
}

export interface City {
  id: string;
  name: string;
  province?: string | null;
  lat: number | string;
  lng: number | string;
}

export const COMPANY_ROLE_ORDER: Record<string, number> = { OWNER: 0, HR: 1, VIEWER: 2 };
export const COMPANY_ROLE_LABEL: Record<string, string> = { OWNER: '所有者', HR: '管理员', VIEWER: '查看者' };
export const MEMBER_STATUS_LABEL: Record<string, string> = { ACTIVE: '正常', INVITED: '待接受', REMOVED: '已移除' };
export const CHANNEL_LABEL: Record<string, string> = { ALIPAY: '支付宝', WECHAT: '微信支付' };
export const CLOSED_REASON_LABEL: Record<string, string> = {
  ADMIN: '管理员下线',
  COMPANY: '企业下线',
  QUOTA_EXCEEDED: '配额回收',
  AUDIT_REJECTED: '审核未通过',
};

/** 企业卡片排序：OWNER > HR > VIEWER */
export function sortMyCompanies(entries: MyCompanyEntry[]): MyCompanyEntry[] {
  return [...entries].sort((a, b) => (COMPANY_ROLE_ORDER[a.role] ?? 9) - (COMPANY_ROLE_ORDER[b.role] ?? 9));
}

/** 读取 /api/companies/me，返回当前企业上下文对应项 */
export function useMyCompanies() {
  const { companyId } = useAuth();
  const [entries, setEntries] = useState<MyCompanyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.get<MyCompanyEntry[]>('/api/companies/me').then((r) => {
      if (alive && r.ok) setEntries(r.data);
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const current = entries.find((e) => e.company.id === companyId) || null;
  return { entries, current, loading, companyId };
}

/**
 * 获取职位详情。GET /api/jobs/[id] 仅返回在招已审职位；
 * 已下线/待审职位回退从企业管理列表（/api/companies/[id]/jobs）中查找。
 */
export async function fetchJobDetail(id: string, companyId: string | null): Promise<JobItem | null> {
  const res = await api.get<JobItem>(`/api/jobs/${id}`);
  if (res.ok) return res.data;
  if (companyId) {
    const list = await api.get<JobItem[]>(`/api/companies/${companyId}/jobs` + qs({ page: 1, pageSize: 50 }));
    if (list.ok) return list.data.find((j) => j.id === id) || null;
  }
  return null;
}
