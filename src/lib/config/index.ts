import { prisma } from '@/lib/db/prisma';

/** 内存缓存：{ site, rec, ... } 60s TTL，后台更新后失效重载 */
const cache = new Map<string, { value: unknown; at: number }>();
const TTL = 60_000;

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await loader();
  cache.set(key, { value, at: Date.now() });
  return value;
}

export function invalidateCache(keys?: string[]) {
  if (!keys) cache.clear();
  else keys.forEach((k) => cache.delete(k));
}

/** 构建时（next build）无数据库连接，返回占位默认值，运行时正常读库 */
function isBuildTime() {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

const DEFAULT_SITE_CONFIG = {
  id: '1',
  site_name: '人才招聘平台',
  site_logo: '',
  maintenance_mode: false,
  maintenance_msg: '',
  sms_enabled: true,
  token_ttl_min: 30,
  refresh_ttl_days: 7,
  max_upload_mb: 10,
  upload_max_mb: 10,
  upload_allowed_types: 'jpg,jpeg,png,pdf,doc,docx',
  allowed_upload_types: 'image/jpeg,image/png,image/webp,application/pdf',
  job_score_max: 10,
  auto_match_enabled: false,
  match_threshold: 60,
  sms_dev_code: '',
  push_enabled: false,
  push_provider: '',
  push_key: '',
  site_desc: '',
  site_keywords: '',
  icp_number: '',
  contact_email: '',
  contact_phone: '',
  contact_address: '',
  wechat_qr: '',
  created_at: new Date(),
  updated_at: new Date(),
} as any;

const DEFAULT_NAV_MENUS: any[] = [
  { id: '1', label: '首页', href: '/', sort: 1, active: true, created_at: new Date() },
  { id: '2', label: '找工作', href: '/jobs', sort: 2, active: true, created_at: new Date() },
  { id: '3', label: '找人才', href: '/companies', sort: 3, active: true, created_at: new Date() },
  { id: '4', label: '兼职', href: '/hourly-jobs', sort: 4, active: true, created_at: new Date() },
];

export async function getSiteConfig() {
  if (isBuildTime()) return DEFAULT_SITE_CONFIG;
  return cached('site_config', async () => {
    const cfg = await prisma.siteConfig.findUnique({ where: { id: 1 } });
    if (!cfg) throw new Error('site_config 未初始化，请先执行 npx prisma db seed');
    return cfg;
  });
}

export async function getRecommendationConfig() {
  return cached('recommendation_config', async () => {
    const cfg = await prisma.recommendationConfig.findUnique({ where: { id: 1 } });
    if (!cfg) throw new Error('recommendation_config 未初始化');
    return cfg;
  });
}

export async function getRatingConfig() {
  return cached('rating_config', async () => {
    const cfg = await prisma.ratingConfig.findFirst();
    if (!cfg) throw new Error('rating_config 未初始化');
    return cfg;
  });
}

export async function getSeoConfig() {
  return cached('seo_config', async () => {
    const cfg = await prisma.seoConfig.findUnique({ where: { id: 1 } });
    if (!cfg) throw new Error('seo_config 未初始化');
    return cfg;
  });
}

/** 前台首页一级栏目（仅启用项，按 sort 升序） */
export async function getNavMenus() {
  if (isBuildTime()) return DEFAULT_NAV_MENUS;
  return cached('nav_menus', async () => {
    return prisma.navMenu.findMany({
      where: { active: true },
      orderBy: [{ sort: 'asc' }, { created_at: 'asc' }],
    });
  });
}

export async function getBackupConfig() {
  return cached('backup_config', async () => {
    const cfg = await prisma.backupConfig.findUnique({ where: { id: 1 } });
    if (!cfg) throw new Error('backup_config 未初始化');
    return cfg;
  });
}

/** 行业缓存（树形，仅 active） */
let industriesCache: unknown = null;
let industriesAt = 0;
export async function getIndustriesTree() {
  if (industriesCache && Date.now() - industriesAt < TTL) return industriesCache;
  const list = await prisma.industry.findMany({
    where: { active: true },
    orderBy: [{ sort: 'desc' }, { name: 'asc' }],
  });
  const tree = list
    .filter((i) => !i.parent_id)
    .map((p) => ({ ...p, children: list.filter((c) => c.parent_id === p.id) }));
  industriesCache = tree;
  industriesAt = Date.now();
  return tree;
}
export function invalidateIndustriesCache() {
  industriesCache = null;
}
