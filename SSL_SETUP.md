# Настройка SSL сертификата для NEO Store

## Вариант 1: Let's Encrypt (бесплатный, рекомендуется)

### Шаг 1: Установите Certbot на сервере

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot

# CentOS/RHEL
sudo yum install certbot
```

### Шаг 2: Проверьте DNS настройки

**Важно:** Убедитесь, что домены указывают на правильный IP адрес сервера!

```bash
# Проверьте DNS записи
nslookup neofoundation.io
nslookup www.neofoundation.io

# Должны показывать IP вашего сервера (например, 2.56.240.126)
```

### Шаг 3: Получите сертификат (метод webroot - работает с запущенным nginx)

**Вариант A: С остановкой контейнеров (если DNS настроен правильно)**

```bash
# Остановите контейнеры
cd ~/neo_store
docker-compose down

# Получите сертификат
sudo certbot certonly --standalone -d neofoundation.io -d www.neofoundation.io

# Запустите контейнеры обратно
docker-compose up -d
```

**Вариант B: Без остановки контейнеров (рекомендуется)**

```bash
# Создайте директорию для webroot
mkdir -p /var/www/certbot

# Получите сертификат через webroot
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d neofoundation.io \
  -d www.neofoundation.io

# Убедитесь, что nginx.conf имеет блок для /.well-known/acme-challenge/
# (он уже добавлен в конфигурацию)
```

**Вариант C: Использование nginx плагина (самый простой)**

```bash
# Установите certbot nginx плагин
sudo apt install python3-certbot-nginx -y

# Получите сертификат (certbot автоматически настроит nginx)
sudo certbot --nginx -d neofoundation.io -d www.neofoundation.io

# Но для Docker нужно будет скопировать сертификаты вручную
```

### Шаг 4: Создайте директорию для SSL сертификатов

```bash
mkdir -p ~/neo_store/nginx/ssl
```

### Шаг 5: Скопируйте сертификаты

```bash
# Копирование сертификатов
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ~/neo_store/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ~/neo_store/nginx/ssl/key.pem

# Установка прав доступа
sudo chmod 644 ~/neo_store/nginx/ssl/cert.pem
sudo chmod 600 ~/neo_store/nginx/ssl/key.pem
sudo chown $USER:$USER ~/neo_store/nginx/ssl/*.pem
```

### Шаг 6: Обновите nginx.conf

Раскомментируйте HTTPS блок в `nginx/nginx.conf` и включите редирект с HTTP на HTTPS.

### Шаг 7: Обновите .env файл

Добавьте HTTPS в `CSRF_TRUSTED_ORIGINS`:

```env
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Шаг 8: Перезапустите контейнеры

```bash
docker-compose up -d
```

### Шаг 9: Настройте автоматическое обновление сертификата

Создайте cron задачу для автоматического обновления:

```bash
sudo crontab -e
```

Добавьте строку:

```cron
0 3 * * * certbot renew --quiet && docker-compose -f /root/neo_store/docker-compose.yml exec -T nginx nginx -s reload
```

---

## Вариант 2: Самоподписанный сертификат (только для тестирования)

**Внимание:** Самоподписанные сертификаты вызывают предупреждения в браузере!

### Шаг 1: Создайте директорию

```bash
mkdir -p ~/neo_store/nginx/ssl
```

### Шаг 2: Создайте самоподписанный сертификат

```bash
cd ~/neo_store/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem \
  -out cert.pem \
  -subj "/C=RU/ST=State/L=City/O=Organization/CN=yourdomain.com"
```

### Шаг 3: Установите права

```bash
chmod 644 cert.pem
chmod 600 key.pem
```

### Шаг 4: Обновите nginx.conf

Раскомментируйте HTTPS блок в `nginx/nginx.conf`.

### Шаг 5: Перезапустите контейнеры

```bash
docker-compose restart nginx
```

---

## Вариант 3: Использование существующего сертификата

Если у вас уже есть SSL сертификаты:

### Шаг 1: Создайте директорию

```bash
mkdir -p ~/neo_store/nginx/ssl
```

### Шаг 2: Скопируйте сертификаты

```bash
# Скопируйте ваш сертификат
cp /path/to/your/certificate.crt ~/neo_store/nginx/ssl/cert.pem
cp /path/to/your/private.key ~/neo_store/nginx/ssl/key.pem

# Установите права
chmod 644 ~/neo_store/nginx/ssl/cert.pem
chmod 600 ~/neo_store/nginx/ssl/key.pem
```

### Шаг 3: Обновите nginx.conf и перезапустите

---

## Проверка SSL

После настройки проверьте:

1. **Откройте сайт по HTTPS:**
   ```
   https://yourdomain.com
   ```

2. **Проверьте сертификат:**
   ```bash
   openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
   ```

3. **Проверьте редирект:**
   ```bash
   curl -I http://yourdomain.com
   # Должен вернуть 301 редирект на HTTPS
   ```

---

## Обновление nginx.conf для включения HTTPS

После получения сертификатов:

1. Откройте `nginx/nginx.conf`
2. Раскомментируйте HTTPS блок (строки с `# server {` для HTTPS)
3. Раскомментируйте редирект в HTTP блоке (строка `# return 301 https://$host$request_uri;`)
4. Перезапустите nginx: `docker-compose restart nginx`

---

## Обновление Django settings

Убедитесь, что в `.env` файле указаны HTTPS домены:

```env
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Также можно добавить в `settings.py`:

```python
# Для продакшена с HTTPS
if not DEBUG:
    SECURE_SSL_REDIRECT = False  # Nginx уже делает редирект
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

---

## Решение проблем

### Ошибка: "SSL certificate not found"

Убедитесь, что:
- Файлы `cert.pem` и `key.pem` существуют в `nginx/ssl/`
- Права доступа установлены правильно
- Путь в nginx.conf правильный

### Ошибка: "Permission denied"

```bash
sudo chown $USER:$USER ~/neo_store/nginx/ssl/*
chmod 644 ~/neo_store/nginx/ssl/cert.pem
chmod 600 ~/neo_store/nginx/ssl/key.pem
```

### Сертификат не обновляется автоматически

Проверьте cron задачу:
```bash
sudo crontab -l
```

---

## Полезные ссылки

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://certbot.eff.org/)
- [Nginx SSL Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)

