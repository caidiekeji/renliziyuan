import { NextRequest } from 'next/server';
import { ok, fail, created } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { getSiteConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** 会话列表（我作为求职者 or 我所属企业的会话） */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);

  const memberships = await prisma.companyMember.findMany({
    where: { user_id: user.id, status: 'ACTIVE' },
    select: { company_id: true },
  });
  const companyIds = memberships.map((m) => m.company_id);
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));

  const where = {
    OR: [
      { candidate_id: user.id },
      ...(companyIds.length ? [{ company_id: { in: companyIds } }] : []),
    ],
  };

  const [total, items] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({
      where,
      orderBy: { last_message_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        job: { select: { id: true, title: true } },
        candidate: { select: { id: true, name: true, avatar: true } },
        company: { select: { id: true, name: true, logo: true } },
        messages: { orderBy: { created_at: 'desc' }, take: 1, select: { id: true, content: true, sender_id: true, created_at: true, read_at: true } },
      },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}

/** 发起会话：求职者从职位详情进入（绑定 job_id），企业成员从求职详情进入（绑定 seeker_post_id） */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const cfg = await getSiteConfig();
  if (!cfg.chat_enabled) return fail('CHAT_DISABLED', '站内沟通已关闭');

  const { job_id, seeker_post_id } = await req.json().catch(() => ({}));

  // 双入口二选一
  if (job_id) {
    const job = await prisma.job.findFirst({ where: { id: job_id, deleted_at: null, status: 'OPEN' } });
    if (!job) return fail('JOB_NOT_FOUND', '职位不存在', 404);
    // 求职者从职位详情发起
    if (user.role !== 'CANDIDATE') return fail('FORBIDDEN', '请以求职者身份发起沟通', 403);
    const existing = await prisma.conversation.findUnique({
      where: { candidate_id_company_id_job_id: { candidate_id: user.id, company_id: job.company_id, job_id: job.id } },
    });
    if (existing) return ok({ id: existing.id, existing: true, conv: existing });

    const conv = await prisma.conversation.create({
      data: { job_id: job.id, candidate_id: user.id, company_id: job.company_id },
    });
    return created({ id: conv.id, existing: false, conv });
  }

  if (seeker_post_id) {
    const post = await prisma.seekerPost.findFirst({ where: { id: seeker_post_id, status: 'OPEN' } });
    if (!post) return fail('NOT_FOUND', '求职信息不存在', 404);
    // 企业成员从求职详情发起
    const member = await prisma.companyMember.findFirst({ where: { user_id: user.id, status: 'ACTIVE' } });
    if (!member) return fail('FORBIDDEN', '仅企业成员可向求职者发起沟通', 403);
    const existing = await prisma.conversation.findFirst({
      where: { company_id: member.company_id, candidate_id: post.user_id, seeker_post_id: post.id },
    });
    if (existing) return ok({ id: existing.id, existing: true, conv: existing });

    const conv = await prisma.conversation.create({
      data: {
        seeker_post_id: post.id,
        candidate_id: post.user_id,
        company_id: member.company_id,
      },
    });
    return created({ id: conv.id, existing: false, conv });
  }

  return fail('VALIDATION_ERROR', '缺少职位 ID 或求职信息 ID');
}
