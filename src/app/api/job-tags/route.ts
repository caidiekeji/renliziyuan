import { ok, handleError } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 获取所有职位标签 */
export async function GET() {
  try {
    const tags = await prisma.jobTag.findMany({ orderBy: { sort: 'asc' } });
    return ok(tags);
  } catch (e) {
    return handleError(e);
  }
}
