# Настройка доступа к GitHub

## Проблема
Ошибка: `Permission to neocoindev/neo_store.git denied to tazhibaevnurs`

## Решение 1: Использовать Personal Access Token (Рекомендуется)

### Шаг 1: Создайте Personal Access Token на GitHub

1. Перейдите на GitHub.com и войдите в аккаунт
2. Нажмите на ваш аватар (правый верхний угол) → **Settings**
3. В левом меню выберите **Developer settings**
4. Выберите **Personal access tokens** → **Tokens (classic)**
5. Нажмите **Generate new token** → **Generate new token (classic)**
6. Заполните форму:
   - **Note**: `NEO Store Project` (любое описание)
   - **Expiration**: Выберите срок действия (например, 90 дней)
   - **Select scopes**: Отметьте `repo` (полный доступ к репозиториям)
7. Нажмите **Generate token**
8. **ВАЖНО**: Скопируйте токен сразу! Он показывается только один раз!

### Шаг 2: Используйте токен для push

После создания токена выполните:

```bash
# Удалите старый remote
git remote remove origin

# Добавьте remote с токеном (замените YOUR_TOKEN на ваш токен)
git remote add origin https://YOUR_TOKEN@github.com/neocoindev/neo_store.git

# Или если remote уже существует, обновите URL:
git remote set-url origin https://YOUR_TOKEN@github.com/neocoindev/neo_store.git

# Запушите код
git push -u origin main
```

**Примечание**: При вводе пароля в терминале используйте токен вместо пароля.

---

## Решение 2: Создать свой репозиторий

Если у вас нет доступа к `neocoindev/neo_store`, создайте свой:

1. Перейдите на https://github.com/new
2. Название: `neo_store` (или другое)
3. Выберите **Public** или **Private**
4. **НЕ** создавайте README, .gitignore или лицензию
5. Нажмите **Create repository**

Затем выполните:

```bash
# Удалите старый remote
git remote remove origin

# Добавьте ваш репозиторий (замените YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/neo_store.git

# Запушите код
git push -u origin main
```

---

## Решение 3: Использовать SSH (если настроен SSH ключ)

```bash
# Удалите старый remote
git remote remove origin

# Добавьте SSH remote
git remote add origin git@github.com:neocoindev/neo_store.git

# Запушите код
git push -u origin main
```

---

## Проверка текущего состояния

```bash
# Проверить remote
git remote -v

# Проверить ветку
git branch

# Проверить коммиты
git log --oneline
```

---

## Безопасность

⚠️ **ВАЖНО**: 
- Никогда не публикуйте Personal Access Token в открытом доступе
- Не коммитьте токены в код
- Храните токены в безопасном месте
- Используйте токены с минимально необходимыми правами

