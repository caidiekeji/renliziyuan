import winston from 'winston';
import crypto from 'crypto';

/** 敏感字段脱敏 */
function mask(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  let v: string = value;
  // 手机号
  const phone = v.match(/(1[3-9]\d{9})/g);
  if (phone) phone.forEach((p) => (v = v.replace(p, p.slice(0, 3) + '****' + p.slice(-4))));
  return v;
}

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format,
  transports: [new winston.transports.Console({ format })],
});

/** 生成或获取 traceId（贯穿 REST/Socket/队列） */
export function newTraceId(): string {
  return crypto.randomBytes(8).toString('hex');
}

/** 结构化日志（自动附 traceId + 脱敏） */
export function log(level: 'error' | 'warn' | 'info' | 'debug', msg: string, meta: Record<string, unknown> = {}) {
  const traceId = meta.traceId || newTraceId();
  const safeMeta: Record<string, unknown> = { ...meta, traceId };
  for (const k of Object.keys(safeMeta)) safeMeta[k] = mask(safeMeta[k]);
  logger[level](msg, safeMeta);
}

export const audit = (adminId: string, action: string, targetType: string, targetId?: string | null, detail?: unknown, ip?: string | null) =>
  log('info', `audit:${action}`, { adminId, action, targetType, targetId, detail, ip });
