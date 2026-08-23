import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

export interface UploadDriver {
  save(buffer: Buffer, ext: string, mime: string, dir: string): Promise<{ url: string; path: string }>;
  delete?(relativePath: string): Promise<void>;
}

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const PUBLIC_BASE = '/uploads';

/** 本机磁盘存储 */
export const LocalDriver: UploadDriver = {
  async save(buffer, ext, _mime, dir = 'misc') {
    const relDir = path.join(dir, new Date().toISOString().slice(0, 10));
    const absDir = path.join(UPLOAD_ROOT, relDir);
    await fs.mkdir(absDir, { recursive: true });
    const filename = `${nanoid(16)}${ext}`;
    const relPath = path.join(relDir, filename);
    await fs.writeFile(path.join(UPLOAD_ROOT, relPath), buffer);
    return { url: `${PUBLIC_BASE}/${relPath.replace(/\\/g, '/')}`, path: relPath };
  },
  async delete(relPath) {
    await fs.unlink(path.join(UPLOAD_ROOT, relPath)).catch(() => undefined);
  },
};

/** 阿里云 OSS（占位，需安装 @alicloud/oss 及配置） */
export const OssDriver: UploadDriver = {
  async save() {
    throw new Error('OSS 驱动未配置，请安装 @alicloud/oss 并设置 UPLOAD_DRIVER=oss');
  },
};

/** AWS S3（占位） */
export const S3Driver: UploadDriver = {
  async save() {
    throw new Error('S3 驱动未配置');
  },
};

export function getUploadDriver(driver: string): UploadDriver {
  if (driver === 'oss') return OssDriver;
  if (driver === 's3') return S3Driver;
  return LocalDriver;
}
