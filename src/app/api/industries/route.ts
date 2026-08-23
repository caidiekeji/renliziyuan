import { ok } from '@/lib/api/response';
import { getIndustriesTree } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** 行业树（公开） */
export async function GET() {
  return ok(await getIndustriesTree());
}
