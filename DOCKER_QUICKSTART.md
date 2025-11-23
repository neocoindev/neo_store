# Быстрый старт Docker

## Разработка

```bash
# 1. Создайте .env файл
cp .env_template .env
# Отредактируйте .env и укажите необходимые переменные

# 2. Запустите контейнеры
docker-compose up --build

# Приложение будет доступно на http://localhost:8000
```

## Продакшен

```bash
# 1. Настройте .env файл с продакшен настройками
# Обязательно установите:
# - SECRET_KEY
# - DEBUG=False
# - ALLOWED_HOSTS
# - CSRF_TRUSTED_ORIGINS
# - Сильные пароли для БД

# 2. Настройте SSL сертификаты (см. DOCKER_DEPLOY.md)

# 3. Запустите в продакшене
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 4. Проверьте логи
docker-compose logs -f
```

## Полезные команды

```bash
# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Просмотр логов
docker-compose logs -f web

# Выполнение команд в контейнере
docker-compose exec web python manage.py migrate
docker-compose exec web python manage.py createsuperuser
```

Подробные инструкции см. в [DOCKER_DEPLOY.md](DOCKER_DEPLOY.md)

