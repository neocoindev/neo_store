# Инструкция по обновлению локальных изменений на Docker сервере

## Быстрый способ

### Для разработки (Development)
```bash
# Использование скрипта
bash update_docker.sh dev

# Или вручную:
docker-compose down
docker-compose build --no-cache web
docker-compose up -d
docker-compose exec web python manage.py collectstatic --noinput
```

### Для продакшена (Production)
```bash
# Использование скрипта
bash update_docker.sh prod

# Или вручную:
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache web
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec web python manage.py collectstatic --noinput
```

## Детальная инструкция

### Вариант 1: Разработка (Development)

В режиме разработки код монтируется через volume, поэтому изменения в файлах применяются автоматически. Однако для некоторых изменений (например, установка новых зависимостей) нужна пересборка.

**Быстрое обновление (только перезапуск):**
```bash
docker-compose restart web
```

**Полное обновление (с пересборкой):**
```bash
# 1. Остановка контейнеров
docker-compose down

# 2. Пересборка образа (если изменились зависимости или Dockerfile)
docker-compose build --no-cache web

# 3. Запуск контейнеров
docker-compose up -d

# 4. Сборка статических файлов (если изменились CSS/JS)
docker-compose exec web python manage.py collectstatic --noinput

# 5. Применение миграций (если изменились модели)
docker-compose exec web python manage.py migrate --noinput
```

### Вариант 2: Продакшен (Production)

В продакшене код копируется в образ при сборке, поэтому **обязательно** нужна пересборка образа.

**Полное обновление:**
```bash
# 1. Остановка контейнеров
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# 2. Получение последних изменений (если используете Git)
git pull

# 3. Пересборка образа
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache web

# 4. Запуск контейнеров
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 5. Применение миграций
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec web python manage.py migrate --noinput

# 6. Сборка статических файлов
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec web python manage.py collectstatic --noinput
```

## Что обновляется автоматически

### В режиме Development:
- ✅ Изменения в Python коде (views, models, etc.) - **автоматически** (через volume mount)
- ✅ Изменения в HTML шаблонах - **автоматически**
- ✅ Изменения в статических файлах (CSS/JS) - **автоматически** (но нужно собрать collectstatic)
- ❌ Изменения в `requirements.txt` - **требует пересборки**
- ❌ Изменения в `Dockerfile` - **требует пересборки**

### В режиме Production:
- ❌ Все изменения - **требуют пересборки образа**

## Частые сценарии

### Обновление только шаблонов/статики (Development)
```bash
docker-compose exec web python manage.py collectstatic --noinput
docker-compose restart web
```

### Обновление Python кода (Development)
```bash
# Обычно достаточно просто перезапуска
docker-compose restart web

# Если не помогло, пересоберите
docker-compose down
docker-compose up -d --build web
```

### Добавление новых зависимостей
```bash
# 1. Обновите requirements.txt локально
# 2. Пересоберите образ
docker-compose build --no-cache web
docker-compose up -d
```

### Обновление на удаленном сервере

Если вы работаете на удаленном сервере:

```bash
# 1. Подключитесь к серверу
ssh user@your-server.com

# 2. Перейдите в директорию проекта
cd /path/to/NEO_Store

# 3. Обновите код (если используете Git)
git pull

# 4. Запустите скрипт обновления
bash update_docker.sh prod

# Или вручную выполните команды из раздела "Продакшен"
```

## Проверка обновления

После обновления проверьте:

```bash
# Статус контейнеров
docker-compose ps

# Логи
docker-compose logs -f web

# Проверка работы приложения
curl http://localhost:8000
```

## Откат изменений

Если что-то пошло не так:

```bash
# Откат к предыдущему образу (если используете Git)
git checkout HEAD~1
docker-compose build --no-cache web
docker-compose up -d
```

## Полезные команды

```bash
# Просмотр логов в реальном времени
docker-compose logs -f web

# Вход в контейнер
docker-compose exec web bash

# Проверка изменений в коде
docker-compose exec web python manage.py check

# Очистка неиспользуемых образов
docker system prune -a
```

## Решение проблем

### Контейнер не запускается после обновления
```bash
# Проверьте логи
docker-compose logs web

# Проверьте конфигурацию
docker-compose config
```

### Изменения не применяются
```bash
# Убедитесь, что контейнер перезапущен
docker-compose restart web

# Проверьте, что файлы действительно изменились
docker-compose exec web ls -la /app/templates/store/
```

### Проблемы с правами доступа
```bash
docker-compose exec web chmod -R 755 /app/media
docker-compose exec web chown -R 1000:1000 /app/media
```

