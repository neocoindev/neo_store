# Скрипт для обновления локальных изменений на Docker сервере (PowerShell)

param(
    [string]$Mode = "dev"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Обновление NEO Store на Docker сервере" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Определяем режим (development или production)
if ($Mode -eq "prod") {
    Write-Host "Режим: PRODUCTION" -ForegroundColor Yellow
    $ComposeFiles = "-f docker-compose.yml -f docker-compose.prod.yml"
} else {
    Write-Host "Режим: DEVELOPMENT" -ForegroundColor Green
    $ComposeFiles = ""
}

Write-Host ""
Write-Host "1. Остановка контейнеров..." -ForegroundColor Cyan
if ($ComposeFiles) {
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
} else {
    docker-compose down
}

Write-Host ""
Write-Host "2. Получение последних изменений из Git (если используется)..." -ForegroundColor Cyan
if (Test-Path ".git") {
    git pull
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Git pull пропущен (не критично)" -ForegroundColor Yellow
    }
} else {
    Write-Host "Git репозиторий не найден, пропускаем git pull" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "3. Пересборка образов..." -ForegroundColor Cyan
if ($ComposeFiles) {
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache web
} else {
    docker-compose build --no-cache web
}

Write-Host ""
Write-Host "4. Запуск контейнеров..." -ForegroundColor Cyan
if ($ComposeFiles) {
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
} else {
    docker-compose up -d
}

Write-Host ""
Write-Host "5. Ожидание готовности сервисов..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "6. Применение миграций (если нужно)..." -ForegroundColor Cyan
if ($ComposeFiles) {
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec -T web python manage.py migrate --noinput
} else {
    docker-compose exec -T web python manage.py migrate --noinput
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "Миграции уже применены" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "7. Сборка статических файлов..." -ForegroundColor Cyan
if ($ComposeFiles) {
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec -T web python manage.py collectstatic --noinput
} else {
    docker-compose exec -T web python manage.py collectstatic --noinput
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "Статика уже собрана" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "8. Проверка статуса контейнеров..." -ForegroundColor Cyan
if ($ComposeFiles) {
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
} else {
    docker-compose ps
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Обновление завершено!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
if ($ComposeFiles) {
    Write-Host "Просмотр логов: docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f" -ForegroundColor Gray
    Write-Host "Остановка: docker-compose -f docker-compose.yml -f docker-compose.prod.yml down" -ForegroundColor Gray
} else {
    Write-Host "Просмотр логов: docker-compose logs -f" -ForegroundColor Gray
    Write-Host "Остановка: docker-compose down" -ForegroundColor Gray
}

