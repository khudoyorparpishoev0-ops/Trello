# API IT-HONA TaskBoard.
#
# Сборка двухстадийная. Общий код (shared/) написан на TypeScript — его нужно
# скомпилировать в ESM, потому что рантайм API остаётся Node 20, а он
# TypeScript не выполняет. Компилятор живёт только в первой стадии и в готовый
# образ не попадает: там по-прежнему Node 20, зависимости API и собранный
# общий код рядом с сервером.
#
# Контекст сборки — корень репозитория (см. docker-compose.yml), иначе
# Dockerfile не увидел бы папку shared/. Копируется при этом только нужное:
# фронтенд, тесты и документация в образ не едут.

FROM node:20-alpine AS shared
WORKDIR /build/shared
# Ставится только TypeScript — окружение фронтенда образу API не нужно.
COPY shared/package.json ./
RUN npm install --no-audit --no-fund
COPY shared/ ./
RUN npx tsc -p tsconfig.json --outDir /build/out

FROM node:20-alpine
WORKDIR /app
COPY api/package.json ./
RUN npm install --omit=dev
COPY api/ ./
# Скомпилированный общий код ложится рядом с сервером: api/*.js обращается к
# нему как ./shared/… — путь одинаков и локально, и в образе.
COPY --from=shared /build/out ./shared
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1 || exit 1
CMD ["node", "server.js"]
