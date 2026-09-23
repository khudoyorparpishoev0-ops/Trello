# syntax=docker/dockerfile:1
# HONA Core 2.0 API — multi-stage (§23.6): сборка TypeScript, затем только production-зависимости.
# Сборка из каталога hona-core/:  docker build -f apps/api/Dockerfile .
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
COPY apps/api apps/api
RUN npx tsc -b apps/api/tsconfig.json

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund --workspace @hona/api

FROM node:22-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/db/dist packages/db/dist
COPY --from=build /app/apps/api/dist apps/api/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "apps/api/dist/server.js"]
