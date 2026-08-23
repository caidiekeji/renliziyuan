/**
 * 生产密钥守卫：模块被 import 时立即校验关键密钥非占位/默认值。
 * 诊断 fail-fast：生产环境若使用弱/占位密钥（oracle 可预测），直接抛错阻止启动，避免线上可被解密/伪造。
 * 开发环境（NODE_ENV!==production）不强制，便于本地验收。
 */
const WEAK: Array<{ key: string; usedDefault: string; hint: string }> = [
  { key: 'JWT_ACCESS_SECRET', usedDefault: 'change-me-access-secret-please-32chars', hint: 'openssl rand -hex 32' },
  { key: 'JWT_REFRESH_SECRET', usedDefault: 'change-me-refresh-secret-please-32chars', hint: 'openssl rand -hex 32' },
];

function assertHexKey(name: string, requiredLen: number, allZeroNum = 16) {
  const v = (process.env[name] || '').trim();
  if (!v) return true; // 未配置：交给下游用默认值或报错，不在此卫
  if (!/^[0-9a-f]+$/i.test(v)) {
    throw new Error(`[env-guard] ${name} 必须是 hex 字符串（openssl rand -hex 32 生成）`);
  }
  if (v.length < requiredLen) {
    throw new Error(`[env-guard] ${name} 长度不足 ${requiredLen} 位 hex`);
  }
  // 全 0/递增前缀等可预测弱值
  const zeros = '0'.repeat(allZeroNum);
  if (v.slice(0, allZeroNum).toLowerCase() === zeros) {
    throw new Error(`[env-guard] ${name} 疑似弱密钥（前 ${allZeroNum} 位全 0），请改为随机值`);
  }
  return true;
}

export function assertEnvSecrets() {
  // 构建阶段（next build 也会置 NODE_ENV=production）不强制，仅在真实运行时保护
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  for (const w of WEAK) {
    const v = process.env[w.key] || '';
    if (v === w.usedDefault || v.length < 32) {
      throw new Error(`[env-guard] ${w.key} 不可使用默认/占位密钥，请用 \`${w.hint}\` 生成`);
    }
  }
  // hex 密钥：必须已配置（未配置时 crypto.ts 无法加解密），且需 32 字节 → 64 位 hex
  for (const name of ['ENCRYPTION_KEY', 'BACKUP_ENCRYPT_KEY']) {
    if (!(process.env[name] || '').trim()) {
      throw new Error(`[env-guard] ${name} 未配置，请用 openssl rand -hex 32 生成`);
    }
    assertHexKey(name, 64);
  }

  // 短信验证码以明文随响应下发：仅限本地验收，生产开启=可被抓包绕过手机认证
  if (process.env.SMS_DEV_MODE === '1') {
    throw new Error('[env-guard] 生产环境禁止 SMS_DEV_MODE=1，请配置真实短信服务商');
  }

  // 站点域名提示：Socket CORS 白名单 / 上传 base / 支付回调均依赖此值
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (site && /localhost|127\.0\.0\.1/.test(site)) {
    console.warn('[env-guard] NEXT_PUBLIC_SITE_URL 仍为本机地址，部署请改为真实域名');
  }
}

if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
  assertEnvSecrets();
}