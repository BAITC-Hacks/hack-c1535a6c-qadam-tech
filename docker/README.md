# ToiTap в Docker

Два контейнера: **frontend** (production build React + Nginx) и **backend** (FastAPI).
Нужны Docker Engine / Docker Desktop и Docker Compose **2.24+**.

## Локальный запуск

Из корня репозитория:

```bash
# Если backend/.env уже заполнен, сохраните его.
# Необязательно: без файла приложение работает с правилами и шаблонами.
# cp backend/.env.example backend/.env

docker compose up -d --build --wait
```

Приложение: **http://127.0.0.1:8080**. Текущие локальные процессы на 5173 и 8765 могут продолжать работать: контейнер backend не публикует свой порт на хост.

Compose передаёт существующий `backend/.env` в backend при запуске. Frontend не получает ключ. Оба `.dockerignore` исключают `.env`, ключи и локальные зависимости из build context; Dockerfile копируют только необходимые файлы. Не публикуйте полный вывод `docker compose config` или `docker inspect`: runtime environment может содержать ключ. Для проверки конфигурации используйте `docker compose config --quiet`.

Ключ на хосте храните с правами `600`. В production с внешним хранилищем секретов значения можно доставлять в окружение backend из этого хранилища; текущий Compose рассчитан на существующий локальный `.env`.

После изменения `.env` пересоздайте backend (обычный restart не перечитывает env_file):

```bash
docker compose up -d --force-recreate --wait backend
```

Если 8080 занят, используйте другой порт при каждом вызове Compose:

```bash
TOITAP_PORT=8081 docker compose up -d --build --wait
```

## Проверки и управление

```bash
docker compose ps
curl -fsS http://127.0.0.1:8080/api/health
python3 docker/smoke.py

docker compose logs --tail=80 backend frontend
docker compose down
```

`llm: true` в health означает наличие ключа. Реальный AI-разбор проверяется запросом: `source: "llm"`; AI-объяснение — полем `explanation_source: "llm"` на каждой карточке. Ошибка или таймаут модели переводит сервис на fallback.

```bash
curl -fsS http://127.0.0.1:8080/api/parse \
  -H 'Content-Type: application/json' \
  -d '{"text":"Нужен ведущий на свадьбу в Алматы 15 октября 2026 года, бюджет до 1 500 000 тенге."}'
```

Healthcheck frontend проверяет Nginx, healthcheck backend — API. Compose ждёт готовности backend перед запуском frontend. Перезапуск упавших процессов автоматический; статус `unhealthy` сам по себе не перезапускает контейнер. Логи ограничены по размеру.

Датасет включён в backend image. JSON-кэш пересоздаётся из CSV внутри контейнера; это производные данные, отдельный volume не нужен. Для изменения каталога обновите CSV и пересоберите backend. Избранное остаётся в localStorage браузера; другой порт — отдельный origin и отдельный список избранного.

## Ubuntu: переход с systemd после локального тестирования

Эти шаги предназначены для согласованного переключения production. Сам локальный запуск Docker не изменяет сервер.

1. Установите Docker Engine и Compose plugin по [официальной инструкции Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Не меняйте существующие Nginx и Certbot.
2. После публикации изменений получите их в `/home/deploy/apps/toitap`; существующий `backend/.env` сохраняется.
3. Проверьте, что 8080 свободен: `sudo ss -lntp 'sport = :8080'`.
4. Запустите `sudo docker compose up -d --build --wait` из репозитория. Старый systemd backend остаётся доступен на 8765.
5. Выполните `python3 docker/smoke.py` и проверьте AI. Только затем переключайте домен.
6. Сохраните резервную копию текущего конфига сайта:

```bash
sudo cp /etc/nginx/sites-available/toitap /etc/nginx/sites-available/toitap.before-docker
sudo nano /etc/nginx/sites-available/toitap
```

В HTTPS server-блоке **только `toi-tap.aribzhan.kz`** замените старые `location /`, `location /api/`, `location /assets/` на блок из [nginx-host-location.conf.example](nginx-host-location.conf.example). Все запросы пойдут на `127.0.0.1:8080`. Сохраните сертификаты, `listen 443`, `server_name` и HTTP → HTTPS redirect от Certbot. Другие сайты не меняйте.

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -fsS https://toi-tap.aribzhan.kz/api/health
```

После проверки сайта и AI остановите старый backend:

```bash
sudo systemctl disable --now toitap
```

HTTPS и продление сертификатов остаются на Nginx/Certbot хоста. Контейнер frontend слушает только localhost хоста; не открывайте наружу 8080 или 8765.

## Откат к прежнему запуску

Старый frontend в `/var/www/toitap` и venv не удаляются при переходе.

```bash
sudo systemctl enable --now toitap
curl --retry 10 --retry-connrefused --retry-delay 2 -fsS http://127.0.0.1:8765/api/health
```

После успешного health восстановите конфигурацию:

```bash
sudo cp /etc/nginx/sites-available/toitap.before-docker /etc/nginx/sites-available/toitap
sudo nginx -t && sudo systemctl reload nginx
curl -fsS https://toi-tap.aribzhan.kz/api/health
```

После проверки домена можно остановить Docker из корня репозитория: `sudo docker compose down`.
