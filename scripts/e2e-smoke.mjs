/* 临时验收冒烟脚本 v2：短信注册/登录 → 企业入驻 → 发布职位 → 筛选 → 求职信息 → 聊天会话 → 评价回复 → 管理员 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const BASE = process.env.E2E_BASE || 'http://localhost:3000';

function makeClient() {
  const jar = new Map();
  async function req(method, path, body, withCookie = true, companyId = '') {
    const headers = { 'Content-Type': 'application/json' };
    if (withCookie && jar.size) {
      const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
      if (cookie) headers['Cookie'] = cookie;
    }
    if (companyId) headers['x-company-id'] = companyId;
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of setCookie) {
      const m = /^([^=]+)=([^;]*)/.exec(c);
      if (m) jar.set(m[1], m[2]);
    }
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json().catch(() => null) : await res.text().catch(() => '');
    return { status: res.status, data };
  }
  return { req };
}

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
}

const client = makeClient();
const cand = makeClient();
const phone = '139' + String(Date.now()).slice(-8);
const candPhone = '138' + String(Date.now()).slice(-8);
let code = '', candCode = '';

// 1) 企业用户注册
let r = await client.req('POST', '/api/auth/send-code', { phone, purpose: 'LOGIN' });
code = r.data?.data?.code || '';
check('发送验证码', /^\d{6}$/.test(code));
r = await client.req('POST', '/api/auth/register', { phone, code, name: '测试企业用户', role: 'COMPANY', password: 'test123456', agree_terms: true, agree_privacy: true });
check('注册企业用户', r.status === 200 && r.data?.data?.user?.role === 'COMPANY', r.data?.error?.message || '');
r = await client.req('POST', '/api/auth/password-login', { phone, password: 'test123456' });
check('企业密码登录', r.status === 200);

// 2) 行业/职位名称
const ind = await client.req('GET', '/api/industries');
const countTree = (nodes) => (nodes || []).reduce((n, x) => n + 1 + countTree(x.children), 0);
const industryCount = countTree(ind.data?.data);
const firstInd = ind.data?.data?.[0];
const industryId = firstInd?.id || firstInd?.children?.[0]?.id || '';
check('行业树可取', industryCount >= 50, `count=${industryCount}`);
const jt = await client.req('GET', '/api/job-titles');
const jobTitleId = jt.data?.data?.find?.((x) => x.category === '技术')?.id || jt.data?.data?.[0]?.id || '';
check('职位名称可取', jt.data?.data?.length >= 300, `count=${jt.data?.data?.length}`);

// 3) 创建企业 + 发布职位
r = await client.req('POST', '/api/companies', { name: `测试企业${Date.now() % 100000}`, industry_id: industryId, size: '1-50', location: '北京', description: '这是一家用于验收测试的企业，提供优质职位与良好发展空间。' });
const companyId = r.data?.data?.id || '';
check('创建企业', (r.status === 200 || r.status === 201) && !!companyId, r.data?.error?.message || '');
r = await client.req('POST', '/api/jobs', {
  title: '测试前端工程师',
  description: '负责公司核心产品前端研发，使用现代前端技术栈，参与架构设计与性能优化，具备良好的团队协作能力。',
  salary_min: 15, salary_max: 25, salary_unit: 'MONTH_K',
  city: '北京', industry_id: industryId, job_title_id: jobTitleId,
  job_type: 'FULL_TIME', experience: 'Y1_3', education: '本科', tags: ['React', 'TypeScript'],
}, true, companyId);
const jobId = r.data?.data?.id || '';
check('发布职位', (r.status === 200 || r.status === 201) && !!jobId, r.data?.error?.message || '');

// 4) 公开职位列表 + 筛选（v2.1-③）
r = await client.req('GET', `/api/jobs?industry_id=${industryId}&job_title_id=${jobTitleId}&pageSize=5`);
check('职位列表+筛选可见', r.data?.data?.some((j) => j.id === jobId), `total=${r.data?.total}`);

// 5) 求职者注册 + 发布求职信息（B.14）
r = await cand.req('POST', '/api/auth/send-code', { phone: candPhone, purpose: 'LOGIN' });
candCode = r.data?.data?.code || '';
r = await cand.req('POST', '/api/auth/register', { phone: candPhone, code: candCode, name: '测试求职者', role: 'CANDIDATE', agree_terms: true, agree_privacy: true });
check('注册求职者', r.status === 200 && r.data?.data?.user?.role === 'CANDIDATE', r.data?.error?.message || '');
r = await cand.req('POST', '/api/seeker-posts', { title: '期望前端开发岗位', city: '北京', expected_salary_min: 12, expected_salary_max: 20, job_type: 'FULL_TIME', skills: ['React', 'TypeScript'], description: '三年前端经验，期望加入优秀团队。' });
const seekerPostId = r.data?.data?.id || '';
check('发布求职信息', (r.status === 200 || r.status === 201) && !!seekerPostId, r.data?.error?.message || '');
r = await client.req('GET', '/api/seeker-posts?city=北京&pageSize=5');
const sp = r.data?.data?.find?.((x) => x.id === seekerPostId);
check('企业人才广场可见求职信息', !!sp, `total=${r.data?.total}`);

// 6) 求职者从职位详情发起会话（B.14）
r = await cand.req('POST', '/api/conversations', { job_id: jobId });
const convId = r.data?.data?.id || '';
check('发起聊天会话', (r.status === 200 || r.status === 201) && !!convId, r.data?.error?.message || `conv=${convId}`);

// 7) 直接写入一条消息（真实场景由 Socket.IO 投递）供评价前置条件
if (convId) {
  const userRow = await prisma.user.findUnique({ where: { phone: candPhone } });
  await prisma.message.create({ data: { conversation_id: convId, sender_id: userRow.id, content: '您好，我对贵公司前端岗位很感兴趣。' } });
  await prisma.conversation.update({ where: { id: convId }, data: { last_message_at: new Date() } });
  check('会话消息写入', true);
  // 求职者查会话消息
  r = await cand.req('GET', `/api/conversations/${convId}/messages`);
  check('会话消息列表', r.status === 200 && r.data?.data?.length >= 1, `msgs=${r.data?.data?.length}`);

  // 8) 求职者评价企业（B.1）
  r = await cand.req('POST', '/api/reviews', { target_type: 'COMPANY', conversation_id: convId, rating: 5, content: '面试流程顺畅，HR 回复及时，整体体验很好。' });
  const reviewId = r.data?.data?.id || '';
  check('求职者评价企业', (r.status === 200 || r.status === 201) && !!reviewId, r.data?.error?.message || `review=${reviewId}`);

  // 9) 企业主页评价墙可见（公开）
  r = await cand.req('GET', `/api/companies/${companyId}/reviews`);
  check('企业评价墙可见', r.data?.data?.items?.some((x) => x.id === reviewId), `count=${r.data?.data?.review_count}`);

  // 10) 企业回复评价
  r = await client.req('POST', `/api/reviews/${reviewId}/reply`, { reply: '感谢您的认可，欢迎加入我们团队！' });
  check('企业回复评价', r.status === 200 && !!r.data?.data, r.data?.error?.message || '');
  r = await client.req('GET', `/api/companies/${companyId}/reviews?manage=1&pageSize=5`, null, true, companyId);
  const managed = r.data?.data?.items?.find?.((x) => x.id === reviewId);
  check('企业后台查看评价+回复', !!managed && !!managed.reply, `reply=${managed?.reply || '无'}`);
}

// 11) 管理员：登录 + 看板 + 评价审核列表
const adm = makeClient();
r = await adm.req('POST', '/api/auth/password-login', { phone: '13800000000', password: 'admin123456' });
check('管理员密码登录', r.status === 200 && r.data?.data?.user?.role === 'ADMIN');
r = await adm.req('GET', '/api/admin/dashboard');
check('管理员看板', r.status === 200 && r.data?.data, `users=${r.data?.data?.totalUsers}`);
r = await adm.req('GET', '/api/admin/reviews');
check('后台评价列表', r.status === 200, `total=${r.data?.meta?.total ?? r.data?.data?.length}`);
r = await adm.req('GET', '/api/admin/audit-logs');
check('操作审计日志', r.status === 200, `total=${r.data?.meta?.total ?? r.data?.data?.length}`);

// 12) 权限隔离
r = await client.req('GET', '/api/admin/dashboard');
check('企业用户访问后台被拒', r.status === 403, `status=${r.status}`);
const anon = makeClient();
r = await anon.req('GET', '/api/admin/dashboard');
check('未登录访问后台被拒', r.status === 401, `status=${r.status}`);

await prisma.$disconnect();
const failed = results.filter((x) => !x.ok);
console.log(`\n==== 汇总: ${results.length - failed.length}/${results.length} PASS ====`);
if (failed.length) console.log('失败项: ' + failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);
