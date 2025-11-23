# Инструкция по деплою NEO Store через Docker

Это руководство поможет вам развернуть проект NEO Store на сервере с использованием Docker и Docker Compose.

## Предварительные требования

- Docker (версия 20.10 или выше)
- Docker Compose (версия 2.0 или выше)
- Сервер с Ubuntu 20.04+ или другой Linux дистрибутив
- Минимум 2GB RAM, 2 CPU cores
- Доменное имя (для продакшена)

## Быстрый старт

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Клонирование проекта

```bash
git clone <your-repo-url> NEO_Store
cd NEO_Store
```

### 3. Настройка переменных окружения

Создайте файл `.env` на основе `.env_template`:

```bash
cp .env_template .env
nano .env
```

Обязательные переменные для продакшена:

```env
SECRET_KEY=your-very-secret-key-here
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

DB_NAME=neostore_db
DB_USER=neostore_user
DB_PASSWORD=strong-password-here
DB_HOST=db
DB_PORT=5432

DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@yourdomain.com
DJANGO_SUPERUSER_PASSWORD=secure-password-here

GUNICORN_WORKERS=3
```

### 4. Разработка (Development)

Для локальной разработки:

```bash
# Сборка и запуск
docker-compose up --build

# Запуск в фоновом режиме
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

Приложение будет доступно по адресу: `http://localhost:8000`

### 5. Продакшен (Production)

#### 5.1. Настройка SSL сертификатов

Создайте директорию для SSL сертификатов:

```bash
mkdir -p nginx/ssl
```

**Вариант 1: Использование Let's Encrypt (рекомендуется)**

```bash
# Установка Certbot
sudo apt install certbot

# Получение сертификата
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Копирование сертификатов
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem
sudo chmod 644 nginx/ssl/cert.pem
sudo chmod 600 nginx/ssl/key.pem
```

**Вариант 2: Самоподписанный сертификат (только для тестирования)**

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem
```

#### 5.2. Запуск в продакшене

```bash
# Сборка и запуск с продакшен конфигурацией
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Просмотр логов
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Проверка статуса
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

#### 5.3. Применение миграций

Миграции применяются автоматически при старте контейнера через `entrypoint.sh`.

Для ручного применения:

```bash
docker-compose exec web python manage.py migrate
```

#### 5.4. Создание суперпользователя

Суперпользователь создается автоматически при первом запуске, если указаны переменные:
- `DJANGO_SUPERUSER_USERNAME`
- `DJANGO_SUPERUSER_PASSWORD`
- `DJANGO_SUPERUSER_EMAIL`

Для ручного создания:

```bash
docker-compose exec web python manage.py createsuperuser
```

#### 5.5. Сборка статических файлов

Статические файлы собираются автоматически при старте контейнера.

Для ручной сборки:

```bash
docker-compose exec web python manage.py collectstatic --noinput
```

## Управление контейнерами

### Просмотр логов

```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f web
docker-compose logs -f db
docker-compose logs -f nginx
```

### Перезапуск сервисов

```bash
# Все сервисы
docker-compose restart

# Конкретный сервис
docker-compose restart web
```

### Остановка и удаление

```bash
# Остановка
docker-compose down

# Остановка с удалением volumes (ОСТОРОЖНО: удалит данные БД!)
docker-compose down -v
```

### Обновление приложения

```bash
# Остановка
docker-compose down

# Получение последних изменений
git pull

# Пересборка и запуск
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Резервное копирование

### Бэкап базы данных

```bash
# Создание бэкапа
docker-compose exec db pg_dump -U neostore_user neostore_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановление из бэкапа
docker-compose exec -T db psql -U neostore_user neostore_db < backup_20240101_120000.sql
```

### Бэкап медиа файлов

```bash
# Создание архива медиа файлов
docker-compose exec web tar -czf /tmp/media_backup.tar.gz /app/media

# Копирование с контейнера
docker cp neo_store_web:/tmp/media_backup.tar.gz ./media_backup.tar.gz
```

## Мониторинг и обслуживание

### Проверка использования ресурсов

```bash
docker stats
```

### Проверка здоровья контейнеров

```bash
docker-compose ps
```

### Доступ к контейнеру

```bash
# Django контейнер
docker-compose exec web bash

# База данных
docker-compose exec db psql -U neostore_user -d neostore_db
```

## Безопасность

### Рекомендации для продакшена:

1. **Измените все пароли по умолчанию** в `.env` файле
2. **Используйте сильный SECRET_KEY** (можно сгенерировать через Django: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`)
3. **Настройте файрвол**:
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```
4. **Регулярно обновляйте Docker образы**:
   ```bash
   docker-compose pull
   docker-compose up -d --build
   ```
5. **Используйте внешнюю БД** в продакшене вместо контейнера
6. **Настройте автоматические бэкапы** БД и медиа файлов

## Решение проблем

### Контейнер не запускается

```bash
# Проверка логов
docker-compose logs web

# Проверка конфигурации
docker-compose config
```

### Проблемы с базой данных

```bash
# Проверка подключения
docker-compose exec web python manage.py dbshell

# Сброс БД (ОСТОРОЖНО!)
docker-compose down -v
docker-compose up -d
```

### Проблемы со статическими файлами

```bash
# Пересборка статики
docker-compose exec web python manage.py collectstatic --noinput --clear
```

### Проблемы с правами доступа

```bash
# Исправление прав на медиа файлы
docker-compose exec web chmod -R 755 /app/media
docker-compose exec web chown -R 1000:1000 /app/media
```

## Дополнительные настройки

### Использование внешней базы данных

Отредактируйте `docker-compose.yml` и закомментируйте сервис `db`, затем укажите внешнюю БД в `.env`:

```env
DB_HOST=your-external-db-host
DB_PORT=5432
DB_NAME=neostore_db
DB_USER=neostore_user
DB_PASSWORD=your-password
```

### Настройка email

Добавьте в `.env`:

```env
MAILGUN_API_KEY=your-api-key
MAILGUN_SENDER_DOMAIN=your-domain.com
FROM_EMAIL=noreply@yourdomain.com
EMAIL_BACKEND=anymail.backends.mailgun.EmailBackend
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
SERVER_EMAIL=noreply@yourdomain.com
```

## Поддержка

При возникновении проблем проверьте:
- Логи контейнеров: `docker-compose logs`
- Статус контейнеров: `docker-compose ps`
- Использование ресурсов: `docker stats`

