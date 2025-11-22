# Деплой NEO Store через Docker

## 📦 Подготовка проекта

Проект готов к деплою через Docker контейнеризацию.

## 🏗️ Архитектура

Проект использует Docker Compose с тремя сервисами:
- **web** - Django приложение (Gunicorn)
- **db** - PostgreSQL база данных
- **nginx** - Веб-сервер для статических файлов и проксирования

## 📋 Требования

- Docker 20.10+
- Docker Compose 2.0+
- Минимум 2GB RAM
- Минимум 10GB свободного места

## 🚀 Быстрый старт

### 1. Клонируйте репозиторий

```bash
git clone https://github.com/neocoindev/neo_store.git
cd neo_store
```

### 2. Создайте файл `.env`

```bash
cp .env.docker.example .env
```

Отредактируйте `.env` и укажите:
- `SECRET_KEY` - секретный ключ Django (сгенерируйте новый)
- `DB_PASSWORD` - пароль для базы данных
- `ALLOWED_HOSTS` - ваш домен или IP адрес
- `DJANGO_SUPERUSER_*` - данные для суперпользователя (опционально)

### 3. Запустите контейнеры

```bash
# Сборка и запуск
docker-compose up -d --build

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

### 4. Примените миграции (если не применились автоматически)

```bash
docker-compose exec web python manage.py migrate
```

### 5. Создайте суперпользователя (если не создался автоматически)

```bash
docker-compose exec web python manage.py createsuperuser
```

### 6. Откройте в браузере

- **HTTP**: http://localhost (через Nginx)
- **Прямой доступ к Django**: http://localhost:8000

## 🔧 Основные команды

### Управление контейнерами

```bash
# Запуск
docker-compose up -d

# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Просмотр статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f web
docker-compose logs -f db
docker-compose logs -f nginx
```

### Работа с базой данных

```bash
# Подключение к базе данных
docker-compose exec db psql -U neostore_user -d neostore_db

# Бэкап базы данных
docker-compose exec db pg_dump -U neostore_user neostore_db > backup.sql

# Восстановление базы данных
docker-compose exec -T db psql -U neostore_user neostore_db < backup.sql
```

### Django команды

```bash
# Миграции
docker-compose exec web python manage.py migrate

# Создание миграций
docker-compose exec web python manage.py makemigrations

# Сборка статических файлов
docker-compose exec web python manage.py collectstatic --noinput

# Создание суперпользователя
docker-compose exec web python manage.py createsuperuser

# Django shell
docker-compose exec web python manage.py shell

# Django shell_plus (если установлен)
docker-compose exec web python manage.py shell_plus
```

### Обновление проекта

```bash
# Остановить контейнеры
docker-compose down

# Обновить код
git pull

# Пересобрать и запустить
docker-compose up -d --build
```

## 🔒 Безопасность для продакшена

### 1. Обновите `.env` файл

```env
SECRET_KEY=сгенерируйте-новый-секретный-ключ
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DB_PASSWORD=сильный-пароль-для-базы-данных
```

### 2. Настройте SSL сертификат

Добавьте SSL конфигурацию в `nginx/nginx.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # ... остальная конфигурация
}
```

### 3. Ограничьте доступ к базе данных

В `docker-compose.yml` уберите проброс порта PostgreSQL:

```yaml
db:
  ports:
    # - "5432:5432"  # Закомментируйте для продакшена
```

### 4. Используйте секреты Docker

Вместо `.env` файла используйте Docker secrets:

```yaml
secrets:
  db_password:
    external: true
```

## 📊 Мониторинг

### Просмотр использования ресурсов

```bash
docker stats
```

### Проверка здоровья контейнеров

```bash
docker-compose ps
```

## 🐛 Отладка

### Просмотр логов

```bash
# Все сервисы
docker-compose logs

# Конкретный сервис
docker-compose logs web
docker-compose logs db
docker-compose logs nginx

# Последние 100 строк
docker-compose logs --tail=100 web
```

### Вход в контейнер

```bash
# Django контейнер
docker-compose exec web bash

# База данных
docker-compose exec db sh

# Nginx
docker-compose exec nginx sh
```

### Проверка подключения к базе данных

```bash
docker-compose exec web python manage.py dbshell
```

## 🔄 Обновление

### Обновление зависимостей

```bash
# Обновите requirements.txt
# Затем пересоберите образ
docker-compose build --no-cache web
docker-compose up -d
```

### Обновление базы данных

```bash
docker-compose exec web python manage.py migrate
```

## 📁 Структура файлов

```
NEO_Store/
├── Dockerfile              # Образ Django приложения
├── docker-compose.yml      # Конфигурация сервисов
├── .dockerignore          # Игнорируемые файлы для Docker
├── entrypoint.sh          # Скрипт запуска контейнера
├── .env.docker.example    # Пример переменных окружения
├── nginx/
│   └── nginx.conf         # Конфигурация Nginx
└── ...
```

## 🌐 Деплой на сервер

### 1. Подготовка сервера

```bash
# Установите Docker и Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Установите Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Клонируйте проект на сервер

```bash
git clone https://github.com/neocoindev/neo_store.git
cd neo_store
```

### 3. Настройте `.env` файл

```bash
cp .env.docker.example .env
nano .env  # Отредактируйте файл
```

### 4. Запустите проект

```bash
docker-compose up -d --build
```

### 5. Настройте домен

Обновите DNS записи для вашего домена, чтобы они указывали на IP сервера.

## 🔧 Полезные скрипты

### Автоматический бэкап

Создайте `backup.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T db pg_dump -U neostore_user neostore_db > backup_$DATE.sql
```

### Автоматическое обновление

Создайте `update.sh`:

```bash
#!/bin/bash
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker-compose exec web python manage.py migrate
docker-compose exec web python manage.py collectstatic --noinput
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи: `docker-compose logs`
2. Проверьте статус контейнеров: `docker-compose ps`
3. Убедитесь, что все переменные окружения установлены правильно

---

**Успешного деплоя! 🚀**

