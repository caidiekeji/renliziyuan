'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 自动定位 hook：进入页面时用浏览器定位解析当前城市。
 * 仅在 enabled（URL 未显式指定城市）时启用；
 * 定位成功 → 逆地理编码（精确）；
 * 拒绝授权/超时/不可用 → 客户端检测出口 IP（ipify）→ 服务端 XXAPI 查询（精确到市/区）；
 * 均失败时静默回退（city=null, done=true）。
 */
export function useAutoCity(enabled: boolean): { city: string | null; done: boolean } {
  const [city, setCity] = useState<string | null>(null);
  const [done, setDone] = useState(!enabled);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;

    const resolve = async (query: string) => {
      try {
        const r = await fetch(`/api/location/current${query}`, { cache: 'no-store' });
        const d = await r.json();
        setCity(d?.data?.city || null);
      } catch {
        setCity(null);
      } finally {
        setDone(true);
      }
    };

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      // 无 geolocation → 检测出口 IP
      resolveWithIp(resolve);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve(`?lat=${coords.latitude}&lng=${coords.longitude}`),
      () => resolveWithIp(resolve),
      { timeout: 5000, maximumAge: 5 * 60 * 1000 }
    );
  }, [enabled]);

  return { city, done };
}

/** 国内可达的 IP 检测服务列表（按优先级排列，第一个成功即返回） */
const IP_DETECT_SERVICES = [
  // api.ip.sb：国内可达、免费、支持 CORS、返回 JSON（支持 IPv6）
  { url: 'https://api.ip.sb/jsonip', parse: (d: any) => d?.ip },
  // ipip.net：国内可达、免费、返回纯文本（支持 IPv6，同时包含城市信息可作备用）
  { url: 'https://myip.ipip.net', parse: (d: string) => {
    const ip = String(d).match(/[\d.:a-fA-F]+/)?.[0];
    return ip && ip.includes('.') ? ip : null; // 优先返回 IPv4（XXAPI 支持更好）
  }},
  // httpbin：海外备用（仅 IPv4）
  { url: 'https://httpbin.org/ip', parse: (d: any) => d?.origin },
];

/**
 * 检测客户端出口 IP，传给后端做 XXAPI 定位。
 * 部署时服务器的 external IP ≠ 用户 IP（如云服务器在 A 城、用户在 B 城），
 * 必须先从客户端侧获取真实 IP 才能定位到用户所在城市。
 * 国内可达服务优先，全部失败则回退到服务端检测。
 */
async function resolveWithIp(resolve: (query: string) => void) {
  for (const svc of IP_DETECT_SERVICES) {
    try {
      const r = await fetch(svc.url, { signal: AbortSignal.timeout(3000) });
      if (!r.ok) continue;
      const ct = r.headers.get('content-type') || '';
      const body = ct.includes('json') ? await r.json() : await r.text();
      const ip = svc.parse(body);
      if (ip && (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) || /^[0-9a-fA-F:]+$/.test(ip))) {
        return resolve(`?ip=${encodeURIComponent(ip)}`);
      }
    } catch {
      // 当前服务不可达，尝试下一个
    }
  }
  resolve(''); // 全部失败 → 回退到后端自动检测
}
