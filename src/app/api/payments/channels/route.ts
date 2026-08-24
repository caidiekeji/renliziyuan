import { ok } from '@/lib/api/response';
import { getAvailableChannels } from '@/lib/payment';

export const dynamic = 'force-dynamic';

/** 可用支付渠道列表：数据库已启用（active）的真实渠道，不含模拟支付 */
export async function GET() {
  const channels = await getAvailableChannels();
  return ok({ channels });
}
