/* 新功能冒烟测试：小时工报名/取消、竞价置顶创建/审核/看板、企业钱包/管理端调账、管理端三域 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const BASE = 'http://localhost:3000';
const COMPANY_ID = '9b517c6f-618a-4a18-967d-55a85192e70b'; // 测试企业61801
const PLAN_STANDARD = '00000000-0000-0000-0000-000000000002';

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

const adm = makeClient();
const co = makeClient();
const cand = makeClient();
let boostId = '';
let hourlyJobId = '';

// 0) 测试前置：给企业开通标准版订阅（可置顶）
await prisma.subscription.deleteMany({ where: { company_id: COMPANY_ID, plan_id: PLAN_STANDARD } });
await prisma.subscription.create({
  data: {
    company_id: COMPANY_ID,
    plan_id: PLAN_STANDARD,
    status: 'ACTIVE',
    start_at: new Date(),
    end_at: new Date(Date.now() + 30 * 864e5),
  },
});
check('前置：开通标准版订阅', true);

// 1) 管理员登录 + 调账 + 钱包列表
let r = await adm.req('POST', '/api/auth/password-login', { phone: '13800000000', password: 'admin123456' });
check('管理员密码登录', r.status === 200 && r.data?.data?.user?.role === 'ADMIN', r.data?.error?.message || '');
r = await adm.req('POST', `/api/admin/wallets/${COMPANY_ID}/adjust`, { delta: 100, reason: '冒烟测试充值' });
check('管理端调账 +100', r.status === 200, r.data?.error?.message || '');
r = await adm.req('GET', '/api/admin/wallets');
const adminWallet = (r.data?.data || []).find((w) => w.company_id === COMPANY_ID);
check('管理端钱包列表', r.status === 200 && !!adminWallet, `balance=${adminWallet?.balance}`);
r = await adm.req('GET', `/api/admin/wallets/${COMPANY_ID}/transactions`);
check('管理端流水查询', r.status === 200 && r.data?.data?.length >= 1, `n=${r.data?.data?.length}`);

// 2) 企业登录 + 钱包
r = await co.req('POST', '/api/auth/password-login', { phone: '13957061429', password: 'test123456' });
check('企业密码登录', r.status === 200, r.data?.error?.message || '');
r = await co.req('GET', '/api/company/wallet', null, true, COMPANY_ID);
check('企业余额查询', r.status === 200 && Number(r.data?.data?.balance) >= 100, `balance=${r.data?.data?.balance}`);

// 3) 发布小时工职位
r = await co.req('POST', '/api/jobs', {
  title: '冒烟-小时工收银员',
  description: '负责门店收银与顾客接待，工作内容简单，适合兼职，欢迎应聘。',
  salary_min: 30, salary_max: 35, salary_unit: 'DAY_YUAN',
  city: '北京', job_type: 'PART_TIME',
  is_hourly: true, hourly_rate: 30, work_period: '每天 9:00-18:00', slots: 5,
}, true, COMPANY_ID);
hourlyJobId = r.data?.data?.id || '';
check('发布小时工职位', (r.status === 200 || r.status === 201) && !!hourlyJobId, r.data?.error?.message || `job=${hourlyJobId}`);
r = await co.req('GET', `/api/companies/${COMPANY_ID}/jobs?is_hourly=true`, null, true, COMPANY_ID);
check('企业小时工列表可见', r.data?.data?.some((j) => j.id === hourlyJobId), `n=${r.data?.data?.length}`);

// 4) 求职者报名 + 我的小时工
r = await cand.req('POST', '/api/auth/password-login', { phone: '13911112222', password: 'test123456' });
check('求职者密码登录', r.status === 200, r.data?.error?.message || '');
r = await cand.req('POST', `/api/jobs/${hourlyJobId}/apply`);
check('求职者报名小时工', r.status === 200 && r.data?.data?.status === 'APPLIED', r.data?.error?.message || '');
r = await cand.req('GET', '/api/me/hourly-applications');
check('我的小时工列表(已报名)', r.data?.data?.some((a) => a.job_id === hourlyJobId && a.status === 'APPLIED'), `n=${r.data?.data?.length}`);
r = await cand.req('POST', `/api/jobs/${hourlyJobId}/apply`);
check('重复报名被拒 409', r.status === 409, r.data?.error?.message || `status=${r.status}`);

// 5) 取消报名
r = await cand.req('DELETE', `/api/jobs/${hourlyJobId}/apply`);
check('取消报名', r.status === 200 && r.data?.data?.status === 'CANCELLED', r.data?.error?.message || '');
r = await cand.req('GET', '/api/me/hourly-applications');
check('我的小时工列表(已取消)', r.data?.data?.some((a) => a.job_id === hourlyJobId && a.status === 'CANCELLED'), '');

// 6) 创建竞价置顶（PENDING）
const today = new Date();
// 用本地时区格式化，避免 toISOString(UTC) 在 UTC+8 凌晨比本地日期早一天导致"开始日期早于今天"
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const start = fmt(today);
const end = fmt(new Date(today.getTime() + 3 * 864e5));
r = await co.req('POST', '/api/company/boosts', {
  job_id: hourlyJobId, city: '北京', job_type: 'HOURLY', bid: 5, start_date: start, end_date: end,
}, true, COMPANY_ID);
boostId = r.data?.data?.id || '';
check('创建竞价置顶', (r.status === 200 || r.status === 201) && !!boostId && r.data?.data?.status === 'PENDING', r.data?.error?.message || `boost=${boostId}`);
r = await co.req('GET', '/api/company/boosts', null, true, COMPANY_ID);
check('企业置顶列表可见', r.data?.data?.some((b) => b.id === boostId), `n=${r.data?.data?.length}`);

// 7) 管理端审核通过
r = await adm.req('GET', '/api/admin/boosts');
const admBoost = (r.data?.data || []).find((b) => b.id === boostId);
check('管理端置顶列表', r.status === 200 && !!admBoost, `status=${admBoost?.status}`);
r = await adm.req('PATCH', `/api/admin/boosts/${boostId}/audit`, { result: 'APPROVED' });
check('置顶审核通过', r.status === 200 && r.data?.data?.status === 'ACTIVE', r.data?.error?.message || '');
r = await adm.req('GET', '/api/admin/boosts/stats');
check('管理端置顶数据概览', r.status === 200, `total=${r.data?.data?.totalBoost ?? r.data?.data?.total ?? 0}`);

// 8) 置顶数据看板（企业）
r = await co.req('GET', `/api/company/boosts/${boostId}/stats`, null, true, COMPANY_ID);
check('置顶数据看板', r.status === 200 && r.data?.data?.status === 'ACTIVE', `rank=${r.data?.data?.rank} cost=${r.data?.data?.cost}`);

// 9) 管理端小时工 + 申请人
r = await adm.req('GET', '/api/admin/hourly-jobs');
check('管理端小时工列表', r.status === 200, `n=${(r.data?.data || []).length}`);
r = await adm.req('GET', `/api/admin/hourly-jobs/${hourlyJobId}/applicants`);
check('管理端申请人记录', r.status === 200, `n=${r.data?.data?.length}`);

// 10) 推荐接口置顶区域（去重结构）
r = await co.req('GET', '/api/jobs/recommended?city=北京');
const rec = r.data?.data;
check('推荐接口返回(置顶+自然结构)', r.status === 200 && rec != null, `keys=${rec ? Object.keys(rec).join(',') : 'null'}`);

await prisma.$disconnect();
const failed = results.filter((x) => !x.ok);
console.log(`\n==== 汇总: ${results.length - failed.length}/${results.length} PASS ====`);
if (failed.length) console.log('失败项: ' + failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);
