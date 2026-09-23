# syntax=docker/dockerfile:1
# HONA Core 2.0 worker — multi-stage (§23.6): сборка TypeScript, затем только production-зависимости.
# Сборка из каталога hona-core/:  docker build -f apps/worker/Dockerfile .
# В образе нет .env и секретов: конфигурация — переменные окружения при запуске.
# Процесс работает от непривилегированного пользователя node; healthcheck — на Node, без curl.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY apps/worker apps/worker
RUN npx tsc -b apps/worker/tsconfig.json

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund --workspace @hona/worker

FROM node:22-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 WORKER_HEALTH_PORT=3001
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/worker/package.json apps/worker/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/db/dist packages/db/dist
COPY --from=build /app/apps/worker/dist apps/worker/dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.WORKER_HEALTH_PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "apps/worker/dist/main.js"]
