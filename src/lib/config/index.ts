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

export async function getSiteConfig() {
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

export async function getSeoConfig() {
  return cached('seo_config', async () => {
    const cfg = await prisma.seoConfig.findUnique({ where: { id: 1 } });
    if (!cfg) throw new Error('seo_config 未初始化');
    return cfg;
  });
}

/** 前台首页一级栏目（仅启用项，按 sort 升序） */
export async function getNavMenus() {
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
