# 🐳 Инструкция по применению изменений на сервере с Docker

## 📋 Быстрая команда (все в одном)

Выполните на сервере:

```bash
cd ~/neo_store

# 1. Решить проблему с файлом миграции
rm -f blog/migrations/0010_alter_blog_options_alter_category_options_and_more.py

# 2. Получить изменения с GitHub
git pull origin main

# 3. Применить миграции Django (внутри контейнера)
docker-compose exec web python manage.py migrate

# 4. Собрать статические файлы (внутри контейнера)
docker-compose exec web python manage.py collectstatic --noinput

# 5. Перезапустить контейнеры (если нужно)
docker-compose restart web
```

## 🔄 Подробная инструкция

### Шаг 1: Решить проблему с файлом миграции

```bash
cd ~/neo_store
rm -f blog/migrations/0010_alter_blog_options_alter_category_options_and_more.py
```

### Шаг 2: Получить изменения с GitHub

```bash
git pull origin main
```

Если возникнут конфликты, решите их вручную или используйте:
```bash
git stash
git pull origin main
git stash pop
```

### Шаг 3: Применить миграции базы данных

```bash
docker-compose exec web python manage.py migrate
```

### Шаг 4: Собрать статические файлы

```bash
docker-compose exec web python manage.py collectstatic --noinput
```

### Шаг 5: Перезапустить контейнеры (если нужно)

**Вариант A: Перезапуск только web контейнера (быстрее)**
```bash
docker-compose restart web
```

**Вариант B: Полный перезапуск всех контейнеров**
```bash
docker-compose down
docker-compose up -d
```

**Вариант C: Пересборка образа (если изменились зависимости)**
```bash
docker-compose build web
docker-compose up -d
```

## 🔍 Проверка статуса

### Проверить статус контейнеров
```bash
docker-compose ps
```

### Просмотреть логи
```bash
# Все сервисы
docker-compose logs -f

# Только web контейнер
docker-compose logs -f web

# Последние 100 строк
docker-compose logs --tail=100 web
```

### Проверить, что контейнеры работают
```bash
docker ps
```

## 🚨 Решение проблем

### Если контейнер не запускается
```bash
# Проверить логи ошибок
docker-compose logs web

# Пересобрать образ
docker-compose build --no-cache web
docker-compose up -d
```

### Если миграции не применяются
```bash
# Войти в контейнер
docker-compose exec web bash

# Выполнить миграции вручную
python manage.py migrate

# Выйти
exit
```

### Если статические файлы не обновляются
```bash
# Очистить статические файлы
docker-compose exec web rm -rf /app/staticfiles/*

# Собрать заново
docker-compose exec web python manage.py collectstatic --noinput

# Перезапустить nginx
docker-compose restart nginx
```

## 📝 Полный скрипт для автоматизации

Создайте файл `update.sh` на сервере:

```bash
#!/bin/bash
set -e

echo "🔄 Обновление проекта NEO Store..."

cd ~/neo_store

echo "📦 Удаление конфликтующих файлов..."
rm -f blog/migrations/0010_alter_blog_options_alter_category_options_and_more.py

echo "⬇️ Получение изменений с GitHub..."
git pull origin main

echo "🗄️ Применение миграций..."
docker-compose exec -T web python manage.py migrate

echo "📁 Сборка статических файлов..."
docker-compose exec -T web python manage.py collectstatic --noinput

echo "🔄 Перезапуск контейнеров..."
docker-compose restart web

echo "✅ Обновление завершено!"
echo "📊 Статус контейнеров:"
docker-compose ps
```

Сделайте скрипт исполняемым:
```bash
chmod +x update.sh
```

Использование:
```bash
./update.sh
```

## ⚡ Быстрая команда (одна строка)

```bash
cd ~/neo_store && rm -f blog/migrations/0010_alter_blog_options_alter_category_options_and_more.py && git pull origin main && docker-compose exec -T web python manage.py migrate && docker-compose exec -T web python manage.py collectstatic --noinput && docker-compose restart web
```

---

**Примечание:** Флаг `-T` в `docker-compose exec -T` отключает TTY, что полезно для автоматизации и скриптов.


