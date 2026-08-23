// 最先加载：设置 globalThis.AsyncLocalStorage 等运行时环境（经 tsx 编译加载 Next 模块时须提前建立，否则 app-render 断言失败）
import 'next/dist/server/node-environment';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import next from 'next';
import { initSocket } from './src/lib/socket/server';
import { log } from './src/lib/logger';
import { getSiteConfig } from './src/lib/config';
import { globalRateLimit } from './src/lib/middleware/rate-limit';

/**
 * 自定义服务端：统一提供 Next.js + Socket.IO（实时聊天）
 * 启动：npm run dev:server（开发）/ npm run start（生产，需先 build）
 * 另在 Node 层做两道全站防护：维护模式拦截 + 公开 GET 接口限流（见 guardRequest）。
 */
const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port, turbopack: false });
const handle = app.getRequestHandler();

/** 与 response.ts 的 getClientIp 保持一致：仅 TRUST_PROXY=1 时信任 X-Forwarded-For */
function getIp(req: IncomingMessage): string {
  if (process.env.TRUST_PROXY === '1') {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  return String(req.headers['x-real-ip'] || '').trim() || req.socket.remoteAddress || '';
}

/** 静态资源 / 内部通道，不参与维护拦截与限流 */
const SKIP_PREFIXES = ['/_next', '/socket.io', '/uploads', '/favicon.ico', '/robots.txt', '/sitemap.xml'];

/** 维护模式下放行的管理侧路径（管理员需能在维护期间登录与操作后台） */
function isAdminAllowed(pathname: string): boolean {
  return (
    pathname.startsWith('/adminli') ||
    pathname.startsWith('/admin/login') ||
    pathname.startsWith('/api/admin') ||
    pathname === '/api/auth/password-login' ||
    pathname === '/api/auth/refresh' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/auth/logout-all'
  );
}

function maintenanceHtml(msg: string): string {
  const text = msg || '系统维护中，请稍后再试。';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>系统维护中</title><style>body{margin:0;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f7f9f8;color:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh}main{text-align:center;padding:0 24px}h1{font-size:22px;margin:0 0 12px}p{font-size:15px;color:#5b6472;margin:0}</style></head><body><main><h1>系统维护中</h1><p>${text}</p></main></body></html>`;
}

/** Node 层全站防护：维护模式拦截 + 公开 GET 接口限流；任何异常均放行（fail-open），不阻断主业务 */
async function guardRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  // 1) 维护模式
  try {
    const cfg = await getSiteConfig();
    if (cfg.maintenance_mode && !isAdminAllowed(pathname)) {
      if (pathname.startsWith('/api')) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'MAINTENANCE', message: cfg.maintenance_msg || '系统维护中' }));
      } else {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Retry-After', '300');
        res.end(maintenanceHtml(cfg.maintenance_msg || ''));
      }
      return true; // 已拦截
    }
  } catch (e) {
    log('error', 'guard:maintenance-check-failed', { error: (e as Error)?.message });
  }

  // 2) 公开 GET 接口限流（100 次/分/IP，登录/验证码等敏感接口由路由自身按 10 次/分限流）
  if (req.method === 'GET' && pathname.startsWith('/api') && !pathname.startsWith('/api/admin') && !pathname.startsWith('/api/auth') && !pathname.startsWith('/api/health')) {
    try {
      const allow = await globalRateLimit(getIp(req), pathname, 'GET');
      if (!allow) {
        res.statusCode = 429;
        res.setHeader('Retry-After', '60');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' }));
        return true; // 已拦截
      }
    } catch (e) {
      log('error', 'guard:rate-limit-failed', { error: (e as Error)?.message });
    }
  }

  return false; // 放行
}

app
  .prepare()
  .then(async () => {
    const server = createServer(async (req, res) => {
      try {
        // 直连（未启用可信反代）时以真实 socket 地址覆盖 x-real-ip（防客户端伪造），供 API 层 getClientIp 获取客户端 IP
        if (process.env.TRUST_PROXY !== '1') {
          const ra = (req.socket.remoteAddress || '').replace(/^::ffff:/i, '');
          if (ra) req.headers['x-real-ip'] = ra;
        }
        const pathname = (req.url || '/').split('?')[0];
        const skip = SKIP_PREFIXES.some((p) => pathname.startsWith(p));
        if (!skip && (await guardRequest(req, res, pathname))) return;
        await handle(req, res);
      } catch (e) {
        log('error', 'server:request-failed', { error: (e as Error)?.message });
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'INTERNAL', message: '服务器内部错误' }));
        }
      }
    });
    await initSocket(server);
    server.listen(port, hostname, () => {
      log('info', 'server:started', { port, dev });
    });
  })
  .catch((err) => {
    log('error', 'server:start-failed', { error: err?.message });
    process.exit(1);
  });