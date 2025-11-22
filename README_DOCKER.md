# 🐳 Docker Quick Start Guide

## Быстрый запуск проекта через Docker

### 1. Предварительные требования

- Docker 20.10+
- Docker Compose 2.0+

### 2. Клонирование и настройка

```bash
git clone https://github.com/neocoindev/neo_store.git
cd neo_store
cp .env.docker.example .env
```

### 3. Редактирование .env

Откройте `.env` и настройте:
- `SECRET_KEY` - сгенерируйте новый ключ
- `DB_PASSWORD` - установите надежный пароль
- `ALLOWED_HOSTS` - укажите ваш домен или IP

### 4. Запуск

```bash
docker-compose up -d --build
```

### 5. Проверка

Откройте в браузере: http://localhost

### 6. Создание суперпользователя

```bash
docker-compose exec web python manage.py createsuperuser
```

## Основные команды

```bash
# Запуск
docker-compose up -d

# Остановка
docker-compose down

# Логи
docker-compose logs -f

# Перезапуск
docker-compose restart

# Обновление
git pull && docker-compose up -d --build
```

Подробная документация: [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)

