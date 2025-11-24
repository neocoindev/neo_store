# Настройка поддомена store.neofoundation.io на Hostinger

## Шаг 1: Добавление поддомена на Hostinger

### Вариант A: Через панель управления Hostinger

1. **Войдите в панель управления Hostinger:**
   - Перейдите на https://www.hosterbox.com/ или https://hpanel.hostinger.com/
   - Войдите в свой аккаунт

2. **Откройте DNS настройки:**
   - Найдите раздел **"Домены"** (Domains)
   - Выберите домен **neofoundation.io**
   - Перейдите в **"DNS Zone"** или **"Управление DNS"**

3. **Добавьте A запись для поддомена:**
   - Нажмите **"Добавить запись"** или **"Add Record"**
   - Выберите тип записи: **A**
   - В поле **"Имя"** или **"Name"** введите: `store`
   - В поле **"Значение"** или **"Value"** введите IP адрес вашего сервера: `2.56.240.126`
   - **TTL**: оставьте по умолчанию (обычно 3600 или 14400)
   - Нажмите **"Сохранить"** или **"Save"**

4. **Проверьте запись:**
   - Убедитесь, что создана запись:
     ```
     Тип: A
     Имя: store
     Значение: 2.56.240.126
     TTL: 3600
     ```

### Вариант B: Через hPanel (новый интерфейс)

1. Войдите в **hPanel**
2. Перейдите в **"Домены"** → **"Управление DNS"**
3. Найдите домен **neofoundation.io**
4. Нажмите **"Добавить запись"**
5. Заполните:
   - **Тип**: A
   - **Имя**: store
   - **Значение**: 2.56.240.126
   - **TTL**: 3600
6. Сохраните

### Вариант C: Через старый интерфейс Hostinger

1. Войдите в **Hostinger Control Panel**
2. Перейдите в **"Домены"** → **"DNS Zone Editor"**
3. Выберите домен **neofoundation.io**
4. В разделе **"Add New Record"**:
   - **Type**: A
   - **Name**: store
   - **Points to**: 2.56.240.126
   - **TTL**: 3600
5. Нажмите **"Add Record"**

---

## Шаг 2: Проверка DNS записи

После добавления записи подождите 5-30 минут для распространения DNS, затем проверьте:

```bash
# На сервере выполните:
nslookup store.neofoundation.io

# Должно показать:
# store.neofoundation.io -> 2.56.240.126
```

Или проверьте онлайн:
- https://www.whatsmydns.net/#A/store.neofoundation.io
- https://dnschecker.org/#A/store.neofoundation.io

---

## Шаг 3: Получение SSL сертификата для поддомена

### Вариант 1: Отдельный сертификат для поддомена

```bash
# На сервере
cd ~/neo_store

# Остановите контейнеры
docker-compose down

# Получите сертификат для поддомена
sudo certbot certonly --standalone -d store.neofoundation.io

# Скопируйте сертификаты
sudo cp /etc/letsencrypt/live/store.neofoundation.io/fullchain.pem ~/neo_store/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/store.neofoundation.io/privkey.pem ~/neo_store/nginx/ssl/key.pem

# Установите права
sudo chmod 644 ~/neo_store/nginx/ssl/cert.pem
sudo chmod 600 ~/neo_store/nginx/ssl/key.pem
sudo chown $USER:$USER ~/neo_store/nginx/ssl/*.pem

# Запустите контейнеры
docker-compose up -d
```

### Вариант 2: Один сертификат для основного домена и поддомена (рекомендуется)

```bash
# Остановите контейнеры
cd ~/neo_store
docker-compose down

# Получите сертификат для всех доменов сразу
sudo certbot certonly --standalone \
  -d neofoundation.io \
  -d www.neofoundation.io \
  -d store.neofoundation.io

# Используйте сертификат для основного домена (он будет работать и для поддомена)
sudo cp /etc/letsencrypt/live/neofoundation.io/fullchain.pem ~/neo_store/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/neofoundation.io/privkey.pem ~/neo_store/nginx/ssl/key.pem

# Установите права
sudo chmod 644 ~/neo_store/nginx/ssl/cert.pem
sudo chmod 600 ~/neo_store/nginx/ssl/key.pem
sudo chown $USER:$USER ~/neo_store/nginx/ssl/*.pem

# Запустите контейнеры
docker-compose up -d
```

---

## Шаг 4: Настройка Nginx для поддомена

Обновите `nginx/nginx.conf` для поддержки поддомена:

```nginx
upstream django {
    server web:8000;
}

# HTTP сервер для основного домена
server {
    listen 80;
    server_name neofoundation.io www.neofoundation.io;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTP сервер для поддомена store
server {
    listen 80;
    server_name store.neofoundation.io;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS сервер для основного домена
server {
    listen 443 ssl http2;
    server_name neofoundation.io www.neofoundation.io;
    client_max_body_size 100M;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    location /static/ {
        alias /static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /media/ {
        alias /media/;
        expires 7d;
        add_header Cache-Control "public";
    }

    location / {
        proxy_pass http://django;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Host $host;
        proxy_redirect off;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}

# HTTPS сервер для поддомена store
server {
    listen 443 ssl http2;
    server_name store.neofoundation.io;
    client_max_body_size 100M;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    location /static/ {
        alias /static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /media/ {
        alias /media/;
        expires 7d;
        add_header Cache-Control "public";
    }

    location / {
        proxy_pass http://django;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Host $host;
        proxy_redirect off;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

---

## Шаг 5: Обновление Django settings

Обновите `.env` файл на сервере:

```bash
nano ~/neo_store/.env
```

Добавьте поддомен:

```env
ALLOWED_HOSTS=neofoundation.io,www.neofoundation.io,store.neofoundation.io,2.56.240.126
CSRF_TRUSTED_ORIGINS=https://neofoundation.io,https://www.neofoundation.io,https://store.neofoundation.io
```

Перезапустите web контейнер:

```bash
docker-compose restart web
```

---

## Шаг 6: Проверка работы

1. **Проверьте DNS:**
   ```bash
   nslookup store.neofoundation.io
   ```

2. **Проверьте SSL:**
   ```bash
   curl -I https://store.neofoundation.io
   ```

3. **Откройте в браузере:**
   ```
   https://store.neofoundation.io
   ```

---

## Решение проблем

### DNS не обновляется

- Подождите до 24 часов (обычно 5-30 минут)
- Очистите DNS кэш: `sudo systemd-resolve --flush-caches` (Linux)
- Проверьте на разных DNS серверах: https://dnschecker.org

### SSL сертификат не выдается

- Убедитесь, что DNS указывает на правильный IP
- Проверьте, что порт 80 свободен
- Убедитесь, что домен доступен из интернета

### 502 Bad Gateway

- Проверьте логи: `docker-compose logs nginx`
- Убедитесь, что web контейнер запущен: `docker-compose ps`
- Проверьте ALLOWED_HOSTS в .env файле

---

## Полезные ссылки

- [Hostinger DNS Documentation](https://support.hostinger.com/en/articles/4421899-how-to-manage-dns-records)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Nginx Server Blocks](https://nginx.org/en/docs/http/server_names.html)

