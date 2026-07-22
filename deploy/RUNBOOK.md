# Подготовка сервера IT-HONA TaskBoard — пошаговый runbook

Боевой сервер под ~20 пользователей: Ubuntu + Docker + Caddy (авто-HTTPS) + весь стек.
Все команды выполняешь **ты сам по SSH**. Пароли/ключи мне присылать не нужно.

Обозначения: `SERVER_IP` — IP сервера, `deploy` — рабочий пользователь,
`board.example.com` — твой будущий домен. Подставляй свои значения.

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

Пока домена нет — оставь в `.env` строку `SITE_ADDRESS=:80` (работаем по IP, без HTTPS).

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

## 7. Домен и HTTPS (когда купишь домен)

Домена нет — купи (примеры регистраторов: **reg.ru, timeweb, cloudflare, namecheap**), затем:

1. В DNS-настройках домена создай **A-запись**: `board` → `SERVER_IP` (TTL можно 300).
2. Дождись, пока `ping board.example.com` покажет твой IP (обычно минуты, иногда до часа).
3. На сервере впиши домен и перезапусти Caddy — HTTPS выпустится автоматически:

```bash
cd /opt/ithona/app
sed -i 's/^SITE_ADDRESS=.*/SITE_ADDRESS=board.example.com/' .env
docker compose up -d
docker compose logs -f caddy      # увидишь получение сертификата Let's Encrypt
```

Теперь платформа доступна по `https://board.example.com` с валидным сертификатом.

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
