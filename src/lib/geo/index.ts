import { log } from '@/lib/logger';
import { prisma } from '@/lib/db/prisma';

/** Haversine 距离（公里），用于"附近职位"计算 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 以城市名解析中心坐标（GCJ-02） */
export async function cityCoord(name: string): Promise<{ lat: number; lng: number } | null> {
  const city = await prisma.city.findUnique({ where: { name } });
  return city ? { lat: Number(city.lat), lng: Number(city.lng) } : null;
}

/**
 * 逆地理编码：BigDataCloud（无需 key，主要）→ Nominatim（备选）
 * 返回 { province, city }
 */
export async function reverseGeocode(lat: number, lng: number): Promise<{ province: string; city: string } | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=zh`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data = await res.json();
      const province = data.principalSubdivision || data.countryName || '';
      const city = data.city || data.locality || '';
      if (city) return { province, city };
    }
  } catch {
    log('warn', 'reverse-geocode:bigdatacloud-failed', { lat, lng });
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=zh`,
      { headers: { 'User-Agent': 'jobbridge/2.1' }, signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data = await res.json();
      const address = data.address || {};
      const city = address.city || address.town || address.county || '';
      const province = address.state || '';
      if (city) return { province, city };
    }
  } catch {
    log('warn', 'reverse-geocode:nominatim-failed', { lat, lng });
  }
  return null;
}

const MUNI_CITIES = ['北京市', '上海市', '天津市', '重庆市'];

/** 回环/内网地址判定（含 IPv6 映射形式），此类 IP 无法用于归属地查询 */
function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  const v = ip.replace(/^::ffff:/i, '');
  if (!v || v === '::1' || v === '::' || v === '127.0.0.1') return true;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(v)) return true;
  if (/^(fe80:|f[cd])/i.test(v)) return true; // IPv6 链路本地 / ULA
  return false;
}

/** 解析 XXAPI address（"中国浙江省金华市永康市"）为 { province, city, county }，按行政区划粒度切分（设计方案 2.9） */
function parseXxapiAddress(address: string): { province: string; city: string; county: string } | null {
  const s = (address || '').replace(/^中国/, '').trim();
  if (!s) return null;
  const muni = MUNI_CITIES.find((m) => s.startsWith(m));
  if (muni) return { province: muni, city: muni, county: '' }; // 直辖市：省市同级
  const pm = s.match(/^(.+?(?:省|自治区|特别行政区))/);
  if (!pm) return null;
  const province = pm[1];
  const rest = s.slice(province.length);
  const cm = rest.match(/^(.+?(?:市|地区|自治州|盟))/);
  if (!cm) return { province, city: '', county: '' }; // 仅到省级（数据中心 IP 常见）
  const city = cm[1];
  const county = (rest.slice(city.length).match(/^(.+?(?:区|县|市))/) || [])[1] || '';
  return { province, city, county };
}

/** XXAPI IP 定位：ip 为公网地址时按 IP 查询；回环/内网则不传（返回调用方出口 IP 归属地） */
async function xxapiLocation(
  ip: string
): Promise<{ province: string; city: string; county: string; lat?: number; lng?: number } | null> {
  const query = ip && !isPrivateIp(ip) ? `?ip=${encodeURIComponent(ip)}` : '';
  try {
    const res = await fetch(`https://v2.xxapi.cn/api/ip${query}`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const d = data?.data || {};
      const parsed = parseXxapiAddress(String(d.address || ''));
      if (!parsed) return null;
      const lat = Number(d.lat);
      const lng = Number(d.lng);
      return { ...parsed, ...(Number.isFinite(lat) ? { lat } : {}), ...(Number.isFinite(lng) ? { lng } : {}) };
    }
  } catch {
    log('warn', 'ip-location:xxapi-failed', { ip });
  }
  return null;
}

/** 解析百度 IP 库 location（如 "广东省深圳市 电信" / "北京市北京市 联通"）为 { province, city } */
function parseBaiduLoc(raw: string): { province: string; city: string } {
  const s = raw.replace(/\s+.*$/, ''); // 去掉运营商后缀
  const muni = MUNI_CITIES.find((m) => s.startsWith(m));
  if (muni) return { province: muni, city: muni };
  const m = s.match(/^(.+?(?:省|自治区|特别行政区))(.+)$/);
  if (m && m[2]) return { province: m[1], city: m[2] };
  return { province: s, city: s };
}

/** 判定是否为 IPv6 地址（含 IPv4-mapped IPv6 如 ::ffff:1.2.3.4） */
function isIPv6(ip: string): boolean {
  const v = ip.replace(/^::ffff:/i, '');
  return v.includes(':');
}

/** ipip.net IP 定位（国内可达、支持 IPv6、中文返回省/市/区），返回 { province, city, county } */
async function ipipLocation(ip: string): Promise<{ province: string; city: string; county: string } | null> {
  try {
    const res = await fetch(`https://myip.ipip.net`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const text = await res.text();
      // 格式："当前 IP：xxx  来自于：中国 浙江 金华  联通"
      const m = text.match(/来自于：(.+?)$/m);
      if (m) {
        const parts = m[1].trim().split(/\s+/); // ["中国","浙江","金华","联通"]
        // 去掉运营商和国家，取省/市/区
        const filtered = parts.filter((p) => !['中国', '联通', '电信', '移动', '广电'].includes(p));
        if (filtered.length >= 2) return { province: filtered[0], city: filtered[1], county: filtered[2] || '' };
        if (filtered.length === 1) return { province: filtered[0], city: '', county: '' };
      }
    }
  } catch {
    log('warn', 'ip-location:ipip-failed', { ip });
  }
  return null;
}

/**
 * IP 定位（设计方案 2.9：XXAPI 主，百度免费库兜底），返回 { province, city, county, lat?, lng? }，失败返回 null。
 * IPv6 地址走 ipip.net（XXAPI 不支持 IPv6），IPv4 走 XXAPI + 百度兜底。
 * 回环/内网 IP 不传参数调 XXAPI——返回服务端出口 IP 归属地。
 */
export async function ipLocation(
  ip: string
): Promise<{ province: string; city: string; county: string; lat?: number; lng?: number } | null> {
  if (!ip) return null;
  if (isPrivateIp(ip)) return xxapiLocation('');
  // IPv6：XXAPI 不支持，走 ipip.net（国内可达、支持 IPv6）
  if (isIPv6(ip)) {
    const r = await ipipLocation(ip);
    if (r) return r;
  }
  const r = await xxapiLocation(ip);
  if (r) return r;
  // 兜底：百度免费 IP 库（仅 IPv4 可用）
  if (!isIPv6(ip)) {
    try {
      const res = await fetch(
        `https://opendata.baidu.com/api.php?query=${encodeURIComponent(ip)}&co=&resource_id=6006&oe=utf8`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (res.ok) {
        const data = await res.json();
        const raw = String(data?.data?.[0]?.location || '');
        if (!raw) return null;
        const { province, city } = parseBaiduLoc(raw);
        return { province, city, county: '' };
      }
    } catch {
      log('warn', 'ip-location-failed', { ip });
    }
  }
  return null;
}
