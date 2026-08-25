#!/bin/sh
set -e

PRISMA="./node_modules/.bin/prisma"
TSX="./node_modules/.bin/tsx"

# 等待 PostgreSQL 就绪（重试 migrate deploy，失败则等待）
echo "[entrypoint] 等待 PostgreSQL 就绪..."
for i in $(seq 1 30); do
  if $PRISMA migrate deploy 2>&1; then
    echo "[entrypoint] 数据库迁移完成"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "[entrypoint] 数据库连接超时，退出"
    exit 1
  fi
  echo "[entrypoint] 等待中... ($i/30)"
  sleep 3
done

# 首次启动自动 seed（用 Prisma 检测 SiteConfig 表是否为空）
echo "[entrypoint] 检查是否需要初始化数据..."
NEED_SEED=$($TSX -e "
  import { PrismaClient } from '@prisma/client';
  const p = new PrismaClient();
  try {
    const r = await p.\$queryRawUnsafe('SELECT count(*)::int as cnt FROM \"SiteConfig\"');
    const cnt = (r as any)[0].cnt;
    console.log(cnt === 0 ? 'yes' : 'no');
  } catch { console.log('yes'); }
  await p.\$disconnect();
" 2>/dev/null)

if [ "$NEED_SEED" = "yes" ]; then
  echo "[entrypoint] 首次启动，执行数据初始化..."
  $TSX prisma/seed.ts 2>&1 && echo "[entrypoint] 数据初始化完成" || echo "[entrypoint] seed 出错（非致命，继续启动）"
else
  echo "[entrypoint] 数据已存在，跳过初始化"
fi

echo "[entrypoint] 启动应用..."
exec $TSX server.ts
