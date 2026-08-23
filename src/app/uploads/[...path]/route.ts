import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/** 本地上传文件静态服务（供 Logo / 图片 / 附件回显）；严防路径穿越 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const rel = segments.join('/');
  const abs = path.resolve(UPLOAD_ROOT, rel);
  // 规范化后必须仍位于 uploads 根目录内
  if (abs !== UPLOAD_ROOT && !abs.startsWith(UPLOAD_ROOT + path.sep)) {
    return new NextResponse('Not Found', { status: 404 });
  }
  try {
    const buf = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=31536000, immutable',
        // 禁止浏览器 MIME 嗅探
        'X-Content-Type-Options': 'nosniff',
        // SVG 可内嵌脚本且与站点同源，强制下载防存储型 XSS
        ...(ext === '.svg' ? { 'Content-Disposition': 'attachment; filename="file.svg"' } : {}),
      },
    });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}