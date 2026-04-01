# =============================================================
# NormBase Portal — единый Dockerfile (монорепо)
# Сборка: docker compose build
# =============================================================

# ── Базовый образ ─────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app


# ══════════════════════════════════════════════════════════════
# API — сборка
# ══════════════════════════════════════════════════════════════
FROM base AS api-deps
WORKDIR /app/api
COPY apps/api/package*.json ./
RUN npm install

FROM api-deps AS api-builder
WORKDIR /app/api
COPY apps/api/prisma ./prisma
RUN npx prisma generate
COPY apps/api/ .
RUN npm run build


# ── API — production образ ────────────────────────────────────
FROM base AS api
WORKDIR /app

ENV NODE_ENV=production

COPY apps/api/package*.json ./
RUN npm install --omit=dev

# Скомпилированный код
COPY --from=api-builder /app/api/dist ./dist

# Prisma клиент
COPY --from=api-builder /app/api/node_modules/.prisma ./node_modules/.prisma
COPY --from=api-builder /app/api/node_modules/@prisma ./node_modules/@prisma

# Prisma схема и миграции
COPY apps/api/prisma ./prisma

RUN mkdir -p /app/storage

EXPOSE 3001

CMD ["node", "dist/main.js"]


# ══════════════════════════════════════════════════════════════
# WEB — сборка
# ══════════════════════════════════════════════════════════════
FROM base AS web-deps
WORKDIR /app/web
COPY apps/web/package*.json ./
RUN npm install

FROM web-deps AS web-builder
WORKDIR /app/web
COPY apps/web/ .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=/api
RUN npm run build

# ── Web — production образ ────────────────────────────────────
FROM base AS web
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone build (указан в next.config.ts: output: 'standalone')
COPY --from=web-builder --chown=nextjs:nodejs /app/web/.next/standalone ./
COPY --from=web-builder --chown=nextjs:nodejs /app/web/.next/static ./.next/static
COPY --from=web-builder --chown=nextjs:nodejs /app/web/public ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
