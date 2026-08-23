import { z } from 'zod';

// ================= 通用 =================
export const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确');
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ================= 认证 =================
export const sendCodeSchema = z.object({ phone: phoneSchema, purpose: z.enum(['LOGIN', 'RESET', 'VERIFY']).default('LOGIN') });
export const registerSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6),
  name: z.string().min(1).max(50),
  password: z.string().min(6).max(64).optional(),
  role: z.enum(['CANDIDATE', 'COMPANY']).default('CANDIDATE'),
  agree_terms: z.boolean().refine((v) => v === true, '必须同意用户协议'),
  agree_privacy: z.boolean().refine((v) => v === true, '必须同意隐私政策'),
});
export const loginSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6),
});
export const passwordLoginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(6).max(64),
});
export const resetPasswordSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6),
  password: z.string().min(6).max(64),
});
export const logoutSchema = z.object({ device: z.enum(['current', 'all']).default('current') });

// ================= 用户 =================
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  avatar: z.string().max(500).optional(),
  bio: z.string().max(2000).optional(),
  title: z.string().max(100).optional(),
  city: z.string().max(50).optional(),
  skills: z.array(z.string().max(30)).max(20).optional(),
});

// ================= 企业 =================
export const companyCreateSchema = z.object({
  name: z.string().min(2).max(100),
  industry_id: z.string().uuid().optional(),
  size: z.string().max(20).optional(),
  location: z.string().max(100).optional(),
  contact_phone: phoneSchema.optional(),
  website: z.string().url().max(200).optional(),
  description: z.string().max(5000).optional(),
});
export const companyUpdateSchema = companyCreateSchema.partial();

// ================= 职位 =================
const workPeriodRegex = /^(?=.*[一-龥\d:\-—~至])/; // 须含中文或时间格式字符，拒绝纯数字/纯符号/纯空白
/** 小时工字段校验（发布全量/更新局部共用） */
function hourlyCheck(d: { is_hourly?: boolean; hourly_rate?: number; work_period?: string; slots?: number }, ctx: z.RefinementCtx) {
  if (d.is_hourly) {
    if (d.hourly_rate == null || d.hourly_rate <= 0)
      ctx.addIssue({ code: 'custom', path: ['hourly_rate'], message: '小时工需填写时薪（元/小时）' });
    if (!d.work_period || !workPeriodRegex.test(d.work_period))
      ctx.addIssue({ code: 'custom', path: ['work_period'], message: '工作时段描述须含中文或时间格式（如"每天 9:00-18:00"）' });
    if (d.slots == null)
      ctx.addIssue({ code: 'custom', path: ['slots'], message: '小时工需填写招聘人数' });
  }
}
const jobBaseSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().min(10).max(20000),
  salary_min: z.coerce.number().int().min(0).optional(),
  salary_max: z.coerce.number().int().min(0).optional(),
  salary_unit: z.enum(['MONTH_K', 'DAY_YUAN']).default('MONTH_K'),
  city: z.string().min(1).max(50),
  industry_id: z.string().uuid().optional(),
  job_title_id: z.string().uuid().optional(),
  job_type: z.enum(['FULL_TIME', 'PART_TIME', 'INTERN', 'CONTRACT']),
  experience: z.enum(['FRESH', 'Y1_3', 'Y3_5', 'Y5']).optional(),
  education: z.string().max(20).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  is_featured: z.boolean().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  // 小时工（v2.0 新增，v2.6 简化：仅发布信息，无视频/签到/完成流程）
  is_hourly: z.boolean().optional(),
  hourly_rate: z.coerce.number().min(0).max(100000).optional(),
  work_period: z.string().max(100).optional(),
  slots: z.coerce.number().int().min(1).max(999).optional(),
});
export const jobPublishSchema = jobBaseSchema.superRefine(hourlyCheck);
export const jobUpdateSchema = jobBaseSchema.partial().superRefine(hourlyCheck);

// ================= 求职信息 =================
export const seekerPostSchema = z.object({
  title: z.string().min(2).max(100),
  expected_salary_min: z.coerce.number().int().min(0).optional(),
  expected_salary_max: z.coerce.number().int().min(0).optional(),
  city: z.string().min(1).max(50),
  job_type: z.enum(['FULL_TIME', 'PART_TIME', 'INTERN', 'CONTRACT']).optional(),
  experience: z.enum(['FRESH', 'Y1_3', 'Y3_5', 'Y5']).optional(),
  education: z.string().max(20).optional(),
  skills: z.array(z.string().max(30)).max(20).optional(),
  description: z.string().max(5000).optional(),
  show_phone: z.boolean().default(true),
});

// ================= 评价 =================
export const reviewCreateSchema = z
  .object({
    target_type: z.enum(['COMPANY', 'CANDIDATE']),
    conversation_id: z.string().uuid().optional(),
    scope: z.enum(['JOB', 'HOURLY']).default('JOB'),
    hourly_application_id: z.string().uuid().optional(),
    rating: z.coerce.number().int().min(1).max(10),
    content: z.string().min(5).max(500),
  })
  .superRefine((d, ctx) => {
    if (d.scope === 'HOURLY' && !d.hourly_application_id)
      ctx.addIssue({ code: 'custom', path: ['hourly_application_id'], message: '小时工评价需提供报名记录 ID' });
    if (d.scope === 'JOB' && !d.conversation_id)
      ctx.addIssue({ code: 'custom', path: ['conversation_id'], message: '普通评价需提供会话 ID' });
  });
export const reviewReplySchema = z.object({ reply: z.string().min(1).max(500) });

// ================= 举报 =================
export const reportSchema = z.object({
  target_type: z.enum(['COMPANY', 'JOB', 'REVIEW', 'USER']),
  target_id: z.string().uuid(),
  reason: z.string().min(5).max(200),
});

// ================= 支付 / 套餐 =================
export const createPaymentSchema = z.object({
  plan_id: z.string().uuid(),
  channel: z.enum(['ALIPAY', 'WECHAT', 'STRIPE']),
});

// ================= 管理后台 =================
export const planSchema = z.object({
  name: z.string().min(1).max(50),
  price_monthly: z.coerce.number().min(0).optional(),
  price_yearly: z.coerce.number().min(0).optional(),
  job_limit: z.coerce.number().int().min(0),
  can_feature: z.boolean().default(false),
  can_view_contacts: z.boolean().default(false),
  duration_days: z.coerce.number().int().min(1),
  active: z.boolean().default(true),
});
export const siteConfigSchema = z.object({
  site_name: z.string().max(50).optional(),
  site_logo: z.string().max(500).nullable().optional(),
  register_enabled: z.boolean().optional(),
  chat_enabled: z.boolean().optional(),
  payment_enabled: z.boolean().optional(),
  audit_mode: z.enum(['PRE', 'POST']).optional(),
  nearby_radius_km: z.coerce.number().int().min(1).max(500).optional(),
  default_city: z.string().max(50).optional(),
  page_size: z.coerce.number().int().min(1).max(100).optional(),
  chat_rate_limit_per_min: z.coerce.number().int().min(1).optional(),
  sms_enabled: z.coerce.boolean().optional(),
  sms_rate_limit_per_min: z.coerce.number().int().min(1).optional(),
  token_ttl_min: z.coerce.number().int().min(5).max(1440).optional(),
  refresh_ttl_days: z.coerce.number().int().min(1).max(365).optional(),
  upload_max_mb: z.coerce.number().int().min(1).max(100).optional(),
  upload_allowed_types: z.string().max(100).optional(),
  upload_driver: z.enum(['local', 'oss', 's3']).optional(),
  upload_base_url: z.string().max(300).optional(),
  rating_max: z.coerce.number().int().min(1).max(10).optional(),
  maintenance_mode: z.boolean().optional(),
  maintenance_msg: z.string().max(200).optional(),
  icp_no: z.string().max(50).optional(),
  contact_email: z.string().email().max(100).optional(),
  reply_review_review: z.boolean().optional(),
  notify_by_sms: z.boolean().optional(),
  queue_attempts: z.coerce.number().int().min(1).max(10).optional(),
  queue_backoff_ms: z.coerce.number().int().min(100).optional(),
  queue_dlq_enabled: z.boolean().optional(),
});
export const navMenuSchema = z.object({
  label: z.string().min(1).max(50),
  href: z.string().min(1).max(200),
  sort: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});
export const recommendationConfigSchema = z.object({
  w_skill: z.coerce.number().min(0).max(100).optional(),
  w_type: z.coerce.number().min(0).max(100).optional(),
  w_city_located: z.coerce.number().min(0).max(100).optional(),
  w_city_expected: z.coerce.number().min(0).max(100).optional(),
  located_city_enabled: z.boolean().optional(),
  w_behavior: z.coerce.number().min(0).max(100).optional(),
  w_b_view: z.coerce.number().min(0).max(100).optional(),
  w_b_favorite: z.coerce.number().min(0).max(100).optional(),
  w_b_chat: z.coerce.number().min(0).max(100).optional(),
  w_hot: z.coerce.number().min(0).max(100).optional(),
  freshness_halflife_days: z.coerce.number().int().min(1).max(365).optional(),
});
export const citySchema = z.object({
  name: z.string().min(1).max(50),
  province: z.string().max(50).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  coord_type: z.string().max(10).default('GCJ02'),
});
export const industrySchema = z.object({
  parent_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(50),
  code: z.string().min(1).max(20),
  sort: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});
export const jobTitleSchema = z.object({
  category: z.string().min(1).max(50),
  sub_category: z.string().max(50).optional(),
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(30),
  sort: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});
export const sensitiveWordSchema = z.object({
  word: z.string().min(1).max(100),
  category: z.string().max(30).optional(),
  scope: z.enum(['ALL', 'JOB', 'REVIEW', 'CHAT']).default('ALL'),
});
export const announcementSchema = z.object({
  type: z.enum(['BANNER', 'NOTICE']),
  title: z.string().min(1).max(100),
  content: z.string().max(5000).optional(),
  image_url: z.string().max(500).optional(),
  sort: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
  start_at: z.string().datetime().nullable().optional(),
  end_at: z.string().datetime().nullable().optional(),
});
export const policySchema = z.object({
  key: z.string().min(1).max(30),
  title: z.string().min(1).max(100),
  content: z.string().min(1),
  version: z.coerce.number().int().min(1).optional(),
});
export const smsConfigSchema = z.object({
  provider: z.enum(['ALIYUN', 'TENCENT', 'VOLCENGINE']),
  access_key: z.string().min(1).max(200),
  secret: z.string().min(1).max(200).optional(),
  sign_name: z.string().min(1).max(50),
  template_code_login: z.string().max(50).optional(),
  template_code_notify: z.string().max(50).optional(),
  endpoint: z.string().max(300).optional(),
  enabled: z.boolean().default(false),
  is_primary: z.boolean().default(false),
});
export const paymentConfigSchema = z.object({
  channel: z.enum(['ALIPAY', 'WECHAT', 'STRIPE']),
  merchant_id: z.string().min(1).max(64),
  secret: z.string().optional(),
  cert_serial: z.string().max(64).optional(),
  platform_cert: z.string().optional(),
  gateway_url: z.string().max(300).optional(),
  sandbox: z.boolean().default(false),
  active: z.boolean().default(true),
});
