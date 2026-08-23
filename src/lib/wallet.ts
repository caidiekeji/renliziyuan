import { prisma } from '@/lib/db/prisma';

/** 获取企业钱包（不存在则创建，balance=0） */
export async function getOrCreateWallet(companyId: string) {
  const existing = await prisma.companyWallet.findUnique({ where: { company_id: companyId } });
  if (existing) return existing;
  return prisma.companyWallet.create({ data: { company_id: companyId } });
}

type Delta = { balance?: number; frozen?: number; recharge?: number; consume?: number };

/**
 * 通用余额变更：数据库事务 + SELECT ... FOR UPDATE 行锁，防并发余额不一致。
 * type 为 WalletTransactionType；amount 为本次交易金额（正数），balance_after 记录交易后余额。
 */
async function changeWallet(
  companyId: string,
  type: 'RECHARGE' | 'CONSUME' | 'FREEZE' | 'UNFREEZE' | 'REFUND' | 'ADJUST',
  amount: number,
  description: string,
  delta: Delta,
  opts: { orderNo?: string | null } = {},
) {
  const result = await prisma.$transaction(async (tx) => {
    const rows = (await tx.$queryRaw`SELECT * FROM "CompanyWallet" WHERE company_id = ${companyId}::uuid FOR UPDATE`) as any[];
    let wallet = rows[0];
    if (!wallet) {
      wallet = await tx.companyWallet.create({ data: { company_id: companyId } });
    }
    const balance = Number(wallet.balance) + (delta.balance ?? 0);
    const frozen = Number(wallet.frozen) + (delta.frozen ?? 0);
    if (balance < -0.001 || frozen < -0.001) throw new Error('INSUFFICIENT_BALANCE');
    const updated = await tx.companyWallet.update({
      where: { company_id: companyId },
      data: {
        balance: Math.round(balance * 100) / 100,
        frozen: Math.round(frozen * 100) / 100,
        total_recharge: { increment: delta.recharge ?? 0 },
        total_consume: { increment: delta.consume ?? 0 },
      },
    });
    const txn = await tx.walletTransaction.create({
      data: {
        company_id: companyId,
        type,
        amount: Math.round(amount * 100) / 100,
        balance_after: Math.round(balance * 100) / 100,
        order_no: opts.orderNo || undefined,
        description,
      },
    });
    return { wallet: updated, txn };
  });
  return result;
}

/** 充值入账 */
export function walletRecharge(companyId: string, amount: number, orderNo: string, description: string) {
  return changeWallet(companyId, 'RECHARGE', amount, description, { balance: amount, recharge: amount }, { orderNo });
}

/** 退款扣回（余额减少；order_no 用于幂等判重） */
export function walletRefund(companyId: string, amount: number, orderNo: string, description: string) {
  return changeWallet(companyId, 'REFUND', amount, description, { balance: -amount }, { orderNo });
}

/** 管理员调账（amount 为本次变动绝对值，delta 可正可负；负向不足余额时抛 INSUFFICIENT_BALANCE） */
export function walletAdjust(companyId: string, delta: number, reason: string) {
  return changeWallet(companyId, 'ADJUST', Math.abs(delta), reason, { balance: delta });
}
