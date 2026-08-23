import crypto from 'crypto';
import '@/lib/config/env-guard';

/** 读取加密密钥（32 字节 hex）；未配置即抛错，避免回退到可预测弱密钥 */
function encryptionKey(): Buffer {
  const v = process.env.ENCRYPTION_KEY;
  if (!v) throw new Error('[crypto] ENCRYPTION_KEY 未配置，请用 openssl rand -hex 32 生成');
  return Buffer.from(v, 'hex');
}

/** AES-256-GCM 加密（密钥来自环境变量 ENCRYPTION_KEY，32 字节 hex） */
export function encryptSecret(plain: string): string {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSecret(encoded: string): string {
  const [v, ivHex, tagHex, dataHex] = encoded.split(':');
  if (v !== 'v1' || !ivHex || !tagHex || !dataHex) return encoded; // 兼容未加密旧数据
  const key = encryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

/** 敏感字段掩码：138****0000 */
export function maskPhone(phone?: string | null): string | null {
  if (!phone) return null;
  if (phone.length < 7) return '****';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

/** SHA-256 摘要（条款内容哈希） */
export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}
