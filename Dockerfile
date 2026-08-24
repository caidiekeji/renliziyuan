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
# Prisma 引擎 + schema（运行时 migrate 需要）
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
# tsx（运行自定义 server.ts）+ 源码
COPY --from=deps /app/node_modules/tsx ./node_modules/tsx
COPY --from=deps /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src ./src

# 上传目录（持久化卷挂载点）
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 自动迁移 + 启动（docker-compose 可覆盖 command）
CMD ["sh", "-c", "npx prisma migrate deploy && node_modules/.bin/tsx server.ts"]
