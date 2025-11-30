#!/bin/bash
# Скрипт для обновления локальных изменений на Docker сервере

set -e

echo "=========================================="
echo "Обновление NEO Store на Docker сервере"
echo "=========================================="

# Определяем режим (development или production)
MODE=${1:-dev}

if [ "$MODE" = "prod" ]; then
    echo "Режим: PRODUCTION"
    COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
else
    echo "Режим: DEVELOPMENT"
    COMPOSE_FILES=""
fi

echo ""
echo "1. Остановка контейнеров..."
docker-compose $COMPOSE_FILES down

echo ""
echo "2. Получение последних изменений из Git (если используется)..."
if [ -d ".git" ]; then
    git pull || echo "Git pull пропущен (не критично)"
else
    echo "Git репозиторий не найден, пропускаем git pull"
fi

echo ""
echo "3. Пересборка образов..."
docker-compose $COMPOSE_FILES build --no-cache web

echo ""
echo "4. Запуск контейнеров..."
docker-compose $COMPOSE_FILES up -d

echo ""
echo "5. Ожидание готовности сервисов..."
sleep 10

echo ""
echo "6. Применение миграций (если нужно)..."
docker-compose $COMPOSE_FILES exec -T web python manage.py migrate --noinput || echo "Миграции уже применены"

echo ""
echo "7. Сборка статических файлов..."
docker-compose $COMPOSE_FILES exec -T web python manage.py collectstatic --noinput || echo "Статика уже собрана"

echo ""
echo "8. Проверка статуса контейнеров..."
docker-compose $COMPOSE_FILES ps

echo ""
echo "=========================================="
echo "Обновление завершено!"
echo "=========================================="
echo ""
echo "Просмотр логов: docker-compose $COMPOSE_FILES logs -f"
echo "Остановка: docker-compose $COMPOSE_FILES down"

