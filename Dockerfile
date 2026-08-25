# ============================================================
# JobBridge — 多阶段 Docker 构建（Next.js standalone + Prisma）
# ============================================================

# ---------- 1. 依赖安装层 ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm install && npx prisma generate

# ---------- 2. 构建层 ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install && npm run build

# ---------- 3. 运行层 ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# standalone 产物（server.js + node_modules）
COPY --from=builder /app/.next/standalone ./
# 静态资源
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Prisma 引擎 + schema + CLI（运行时 migrate + seed 需要）
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/prisma ./prisma
# tsx（运行自定义 server.ts）+ 源码
COPY --from=deps /app/node_modules/tsx ./node_modules/tsx
COPY --from=deps /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src ./src

# 入口脚本 + pg（等待 PG 就绪用）
COPY --from=builder /app/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# uploads 目录 + 权限（nextjs 用户可写）
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads
# prisma 缓存目录权限（migrate deploy 需要写入）
RUN chown -R nextjs:nodejs /app/node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 自动迁移 + seed（仅首次） + 启动
CMD ["sh", "./docker-entrypoint.sh"]
