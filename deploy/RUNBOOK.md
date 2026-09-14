# Подготовка сервера IT-HONA TaskBoard — пошаговый runbook

Боевой сервер под ~20 пользователей: Ubuntu + Docker + Caddy (авто-HTTPS) + весь стек.
Все команды выполняешь **ты сам по SSH**. Пароли/ключи мне присылать не нужно.

Обозначения: `SERVER_IP` — IP сервера, `deploy` — рабочий пользователь,
`core.ithona.tj` — рабочий домен платформы. В примерах, где встречается другой адрес, подставляйте свой.

---

## 0. Перед началом (на своём компьютере)

Не отправляй root-пароль в чат. Сгенерируй SSH-ключ, если его ещё нет:

```bash
ssh-keygen -t ed25519 -C "ithona"      # Enter на все вопросы
cat ~/.ssh/id_ed25519.pub               # это ПУБЛИЧНЫЙ ключ — понадобится ниже
```

На VPS в панели is\*hosting поставь ОС **Ubuntu 24.04 LTS** и узнай `SERVER_IP`.

---

## 1. Первый вход и базовая настройка

```bash
ssh root@SERVER_IP                      # первый и последний раз по паролю провайдера

apt update && apt upgrade -y
timedatectl set-timezone Asia/Tashkent  # свой пояс
hostnamectl set-hostname ithona-board
```

Создай рабочего пользователя (не работаем под root):

```bash
adduser deploy                          # задай пароль
usermod -aG sudo deploy
```

Пропиши свой публичный ключ этому пользователю:

```bash
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo "ВСТАВЬ_СЮДА_СОДЕРЖИМОЕ_id_ed25519.pub" > /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
```

Проверь вход ключом **в новом окне терминала** (не закрывая root-сессию):

```bash
ssh deploy@SERVER_IP                     # должно пустить без пароля
```

---

## 2. Защита SSH (отключаем пароль и root)

Под `deploy` (через `sudo`):

```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

> После этого вход возможен только по ключу и только под `deploy`. Если засветил root-пароль раньше — теперь он бесполезен для входа.

---

## 3. Файрвол, fail2ban, авто-обновления

```bash
sudo apt install -y ufw fail2ban unattended-upgrades

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH        # 22
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

sudo systemctl enable --now fail2ban
sudo dpkg-reconfigure -plow unattended-upgrades   # выбрать Yes
```

---

## 4. Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
newgrp docker            # или перелогинься, чтобы группа применилась
docker --version && docker compose version
```

---

## 5. Код и секреты

```bash
sudo mkdir -p /opt/ithona && sudo chown deploy:deploy /opt/ithona
cd /opt/ithona
git clone https://github.com/khudoyorparpishoev0-ops/Trello.git app
cd app
git checkout claude/kanban-platform-prototype-0y8wef
```

> Если репозиторий приватный, `git clone` попросит авторизацию. Варианты:
> - GitHub → Settings → Developer settings → **Personal Access Token** (scope `repo`),
>   вставить как пароль при клоне; либо
> - добавить **deploy key** (SSH-ключ сервера) в настройки репозитория (Deploy keys, read-only); либо
> - просто скопировать файлы на сервер: `scp -r ./Trello deploy@SERVER_IP:/opt/ithona/app`.

```bash
# секреты
cp .env.example .env
# сгенерируй сильные пароли и впиши их в .env вместо change_me_*
openssl rand -base64 24   # для POSTGRES_PASSWORD
openssl rand -base64 24   # для MINIO_ROOT_PASSWORD
nano .env
chmod 600 .env
```

Домен уже настроен: в `.env` стоит `SITE_ADDRESS=core.ithona.tj`, HTTPS выпускается автоматически (раздел 7). На новом сервере до настройки домена оставляют `SITE_ADDRESS=:80` — работа по IP, без HTTPS.

---

## 6. Запуск стека

```bash
docker compose up -d --build     # первая сборка ~2–4 мин
docker compose ps                # все сервисы healthy/running
```

Проверка:

```bash
curl http://localhost/api/health           # {"status":"ok","checks":{"postgres":"up","redis":"up"}}
```

Открой в браузере `http://SERVER_IP` — увидишь доску. Готово, стек работает по IP.

---

## 7. Домен и HTTPS

Рабочий домен платформы — **`core.ithona.tj`**. Он уже настроен, HTTPS выпущен
автоматически. Этот раздел описывает, как оно устроено, как проверить и что
делать, если домен придётся менять.

### Как настроено

1. **DNS.** У домена `ithona.tj` заведена A-запись: `core` → IP сервера.
   Записи хватает одной, поддомен `www` для платформы не нужен.
2. **Режим записи — «DNS only».** Если в Cloudflare включить проксирование
   (оранжевое облако), Caddy перестанет получать сертификат: проверка владения
   доменом идёт напрямую на сервер, а проксирование её перехватывает. Оставляйте
   серое облако.
3. **Адрес в `.env`:** `SITE_ADDRESS=core.ithona.tj`. По нему Caddy понимает, что
   работать надо по HTTPS, и сам запрашивает сертификат Let's Encrypt.

### Проверить, что всё в порядке

```bash
cd /opt/ithona/app
grep '^SITE_ADDRESS=' .env                      # ожидаем core.ithona.tj
curl -sI https://core.ithona.tj | head -1       # ожидаем HTTP/2 200
curl -s https://core.ithona.tj/api/health       # состояние сервисов
echo | openssl s_client -connect core.ithona.tj:443 -servername core.ithona.tj 2>/dev/null \
  | openssl x509 -noout -dates                  # до какого числа действует сертификат
```

Сертификат Caddy продлевает сам, примерно за месяц до конца срока. Вмешиваться
не нужно — достаточно, чтобы сервер был доступен из интернета по портам 80 и 443.

### Если сертификат не выпустился

```bash
docker compose logs --tail 50 caddy
```

Три обычные причины, в порядке частоты:

- в Cloudflare включено проксирование (нужно «DNS only»);
- A-запись ещё не разошлась — проверьте `dig +short core.ithona.tj`, она должна
  показать IP сервера;
- закрыт порт 80: он нужен именно для выпуска сертификата, даже если сайт потом
  работает только по 443.

### Если домен меняется

```bash
cd /opt/ithona/app
sed -i 's/^SITE_ADDRESS=.*/SITE_ADDRESS=новый.домен.tj/' .env
docker compose up -d
docker compose logs -f caddy      # видно получение нового сертификата
```

Перед этим заведите A-запись на новый домен и дождитесь, пока `dig +short`
покажет IP сервера. Старый сертификат останется в томе Caddy и мешать не будет.

### Работа без домена

Если платформу поднимают заново на другом сервере и домена пока нет — в `.env`
оставляют `SITE_ADDRESS=:80`. Тогда всё работает по IP и без HTTPS: это
допустимо только для проверки, пароли по такому адресу передаются открыто.

---

## 8. Ежедневный бэкап БД

```bash
chmod +x /opt/ithona/app/deploy/backup.sh
( crontab -l 2>/dev/null; echo "0 3 * * * /opt/ithona/app/deploy/backup.sh >> /var/log/ithona-backup.log 2>&1" ) | crontab -
sudo touch /var/log/ithona-backup.log && sudo chown deploy /var/log/ithona-backup.log
/opt/ithona/app/deploy/backup.sh      # прогнать разово для проверки
```

Дампы: `/opt/ithona/backups/`, хранятся 14 дней. Рекомендую периодически копировать их и на другую машину/облако.

---

## 9. Обновление версии (деплой)

> **Разовое требование после перехода на общий код.** Образ API теперь
> собирается из корня репозитория: ему нужна папка `shared/`, которую
> компилирует отдельная стадия сборки. Первый деплой после этого изменения
> обязан быть с `--build` — без него docker возьмёт прежний образ, собранный по
> старому Dockerfile, и сервер запустится без общего кода.

```bash
cd /opt/ithona/app
git pull
docker compose up -d --build
```

---

## 10. Полезное

```bash
docker compose ps                 # статус
docker compose logs -f api        # логи сервиса
docker compose restart caddy      # перезапуск
docker compose down               # остановить всё (данные в volume сохраняются)
docker system prune -f            # почистить мусор образов
```

---

## Что уже готово, а что впереди

- ✅ Готово сейчас: сервер, безопасность, HTTPS, фронтенд-доска, PostgreSQL, Redis, MinIO, бэкапы.
- 🔜 Дальше по ТЗ: реальный API (аккаунты, доски, карточки), WebSocket-синхронизация,
  уведомления (в т.ч. Telegram-бот), затем мобильные приложения.
  Сейчас `api` — заготовка с health-check; она подтверждает, что стек связан и готов к наполнению.
