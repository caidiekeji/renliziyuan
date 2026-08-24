import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { getSiteConfig } from '@/lib/config';
import { getUploadDriver } from '@/lib/upload/driver';
import { rateLimit } from '@/lib/middleware/rate-limit';
import Busboy from 'busboy';

export const dynamic = 'force-dynamic';

const MIME_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

/** 文件上传（multipart/form-data），限大小与类型 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  if (!(await rateLimit(`upload:${user.id}`, 30, 60))) return fail('RATE_LIMITED', '上传过于频繁', 429);

  const cfg = await getSiteConfig();
  const allowedTypes = cfg.upload_allowed_types.split(',').map((t: string) => t.trim());
  const maxBytes = cfg.upload_max_mb * 1024 * 1024;

  const contentType = req.headers.get('content-type') || '';
  const busboy = Busboy({ headers: { 'content-type': contentType }, limits: { fileSize: maxBytes, files: 1 } });

  return new Promise<Response>((resolve) => {
    const driver = getUploadDriver(cfg.upload_driver);
    let saved: { url: string; path: string } | null = null;
    let uploadError: string | null = null;
    // 异步落盘 Promise：close 时等待其完成，避免竞态误报"未收到文件"
    let pendingSave: Promise<void> = Promise.resolve();

    busboy.on('file', (name, stream, info) => {
      const { mimeType } = info;
      // 仅信任 MIME 白名单，避免双重后缀（如 malware.jpg.exe）绕过扩展名校验
      const ext = MIME_MAP[mimeType];
      if (!ext || !allowedTypes.includes(ext.replace('.', ''))) {
        uploadError = '不支持的文件类型';
        stream.resume();
        return;
      }
      // 超出大小限制：busboy 会截断流，必须显式报错而非静默保存半个文件
      stream.on('limit', () => {
        uploadError = `文件超过 ${cfg.upload_max_mb}MB 限制`;
      });
      const chunks: Buffer[] = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => {
        if (uploadError) return;
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          uploadError = '空文件';
          return;
        }
        pendingSave = (async () => {
          try {
            saved = await driver.save(buffer, MIME_MAP[mimeType], mimeType, 'misc');
          } catch (e: any) {
            uploadError = e?.message || '上传失败';
          }
        })();
      });
    });

    busboy.on('error', (e: any) => {
      uploadError = e?.message === 'Request aborted' ? '文件过大' : (e?.message || '上传失败');
    });

    busboy.on('close', () => {
      // 等待异步落盘完成后再响应
      pendingSave.then(() => {
        if (uploadError) return resolve(fail('UPLOAD_FAILED', uploadError));
        if (!saved) return resolve(fail('UPLOAD_FAILED', '未收到文件'));
        const base = cfg.upload_base_url || '';
        resolve(ok({ url: `${base}${saved.url}`, path: saved.path }));
      });
    });

    // 读取请求体并写入 busboy
    const reader = req.body!.getReader();
    const pump = () =>
      reader.read().then(({ done, value }) => {
        if (done) {
          busboy.end();
          return;
        }
        busboy.write(Buffer.from(value));
        pump();
      });
    pump().catch((e) => resolve(fail('UPLOAD_FAILED', e?.message || '上传失败')));
  });
}
