#!/bin/bash
set -e

echo "Waiting for database..."
max_attempts=60
attempt=0
while ! nc -z ${DB_HOST:-db} ${DB_PORT:-5432}; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "Database connection failed after $max_attempts attempts"
    exit 1
  fi
  echo "Attempt $attempt/$max_attempts: Database is not ready yet. Waiting..."
  sleep 1
done
echo "Database is ready!"

# Применяем миграции
echo "Running migrations..."
python manage.py migrate --noinput || {
    echo "Migration failed!"
    exit 1
}

# Собираем статические файлы
echo "Collecting static files..."
python manage.py collectstatic --noinput || {
    echo "Collectstatic failed!"
    exit 1
}

# Создаем суперпользователя если не существует (опционально)
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    echo "Checking for superuser..."
    python << EOF
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ecom_prj.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    print("Creating superuser...")
    User.objects.create_superuser(
        username=os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin'),
        email=os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@example.com'),
        password=os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'admin123')
    )
    print("Superuser created!")
else:
    print("Superuser already exists.")
EOF
fi

# Запускаем сервер
echo "Starting Gunicorn..."
exec gunicorn ecom_prj.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers ${GUNICORN_WORKERS:-3} \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -

