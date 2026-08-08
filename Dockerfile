# Фронтенд IT-HONA TaskBoard: сборка Vite → раздача статики nginx.
# Многостадийная сборка: node только для build, в финальный образ не попадает.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# Адрес указан как 127.0.0.1, а не localhost: в контейнере localhost может
# резолвиться в IPv6 (::1), тогда как nginx слушает только IPv4 — проверка
# падала, и контейнер помечался unhealthy при полностью рабочем сайте.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
