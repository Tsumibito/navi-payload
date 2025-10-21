# 🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА БЕЗОПАСНОСТИ - ПЛАН ДЕЙСТВИЙ

GitGuardian обнаружил утечку пароля PostgreSQL в вашем публичном GitHub репозитории `Tsumibito/navi-payload`.

## ⚠️ СРОЧНЫЕ ДЕЙСТВИЯ (выполнить немедленно!)

### 1. Смените пароль базы данных

**У вашего провайдера хостинга БД:**
- Зайдите в панель управления БД
- Смените пароль пользователя `navi_user`
- Обновите `.env` файл с новым паролем

**Текущий доступ (проверьте свои значения):**
```
Host: <адрес_БД>
User: <пользователь>
Database: <имя_БД>
Schema: <схема>
```

### 2. Очистите Git историю от паролей

#### Вариант А: Используя BFG Repo-Cleaner (рекомендуется)

```bash
# 1. Установите BFG
brew install bfg  # для macOS

# 2. Создайте файл со строками для удаления
cat > passwords.txt << 'EOF'
<старый_пароль>
EOF

# 3. Клонируйте репозиторий как bare
git clone --mirror https://github.com/Tsumibito/navi-payload.git navi-payload-clean.git

# 4. Запустите BFG
cd navi-payload-clean.git
bfg --replace-text ../passwords.txt

# 5. Очистите и отправьте
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```

#### Вариант Б: Используя git-filter-repo

```bash
# 1. Установите git-filter-repo
brew install git-filter-repo  # для macOS

# 2. В вашем репозитории
cd /Users/al1/Navi/CascadeProjects/windsurf-project/navi-payload

# 3. Создайте файл замены
cat > replacements.txt << 'EOF'
<старый_пароль>==><REMOVED_PASSWORD>
postgresql://navi_user:<старый_пароль>@==>postgresql://navi_user:<REMOVED_PASSWORD>@
EOF

# 4. Запустите фильтрацию
git filter-repo --replace-text replacements.txt --force

# 5. Добавьте remote обратно (filter-repo его удаляет)
git remote add origin https://github.com/Tsumibito/navi-payload.git

# 6. Force push (ВНИМАНИЕ: перезапишет всю историю!)
git push --force --all
git push --force --tags
```

#### Вариант В: Удалите репозиторий и создайте новый (самый простой)

```bash
# 1. На GitHub: Settings → Delete this repository
# 2. Создайте новый репозиторий navi-payload
# 3. В локальной папке:
cd /Users/al1/Navi/CascadeProjects/windsurf-project/navi-payload
rm -rf .git
git init
git add .
git commit -m "Initial commit (cleaned)"
git remote add origin https://github.com/Tsumibito/navi-payload.git
git push -u origin main
```

### 3. Проверьте другие файлы

Убедитесь что нет других файлов с паролями:

```bash
# Поиск потенциально опасных строк
grep -r "password" --include="*.ts" --include="*.js" --include="*.json" .
grep -r "secret" --include="*.ts" --include="*.js" --include="*.json" .
grep -r "token" --include="*.ts" --include="*.js" --include="*.json" .
```

### 4. Настройте защиту на будущее

#### А. Убедитесь что .gitignore настроен правильно

Файл `.gitignore` уже содержит `.env*`, но проверьте:

```bash
cat .gitignore | grep env
```

Должно быть: `.env*`

#### Б. Используйте pre-commit hook

Создайте `.git/hooks/pre-commit`:

```bash
#!/bin/bash
if git diff --cached --name-only | grep -E "\.env"; then
  echo "❌ Попытка закоммитить .env файл!"
  exit 1
fi

# Проверка на пароли в коде
if git diff --cached | grep -E "(password|secret|token).*=.*['\"]"; then
  echo "⚠️  Внимание: найдены потенциальные секреты в коде!"
  echo "Проверьте изменения перед коммитом."
fi
```

Сделайте исполняемым:
```bash
chmod +x .git/hooks/pre-commit
```

#### В. Используйте git-secrets (рекомендуется)

```bash
# Установка
brew install git-secrets

# Настройка для репозитория
cd /Users/al1/Navi/CascadeProjects/windsurf-project/navi-payload
git secrets --install
git secrets --register-aws

# Добавьте кастомные паттерны
git secrets --add 'postgres://[^:]+:[^@]+@'
git secrets --add 'postgresql://[^:]+:[^@]+@'
```

## 📋 Чеклист выполнения

- [ ] Паролей БД изменён у провайдера
- [ ] `.env` обновлён с новым паролем
- [ ] Git история очищена от старого пароля
- [ ] Force push выполнен на GitHub
- [ ] Проверены все файлы на наличие других секретов
- [ ] Настроен pre-commit hook или git-secrets
- [ ] GitGuardian уведомлён о решении проблемы

## 🔍 Дополнительные проверки

### Проверьте кто мог получить доступ

Посмотрите логи доступа к БД за последние дни:

```sql
-- Если ваш провайдер поддерживает
SELECT * FROM pg_stat_activity 
WHERE datname = 'postgres' 
ORDER BY backend_start DESC;
```

### Проверьте репозиторий на GitGuardian

После очистки зайдите на https://dashboard.gitguardian.com и убедитесь что алерт закрыт.

## ⚠️ ВАЖНО

После выполнения всех шагов:
1. **Все разработчики** должны сделать fresh clone репозитория
2. **НЕ делайте** merge старых веток без rebase
3. **Сообщите команде** о смене пароля БД

## 📞 Поддержка

Если у вас возникли проблемы с очисткой истории:
- GitHub Support: https://support.github.com
- GitGuardian: https://dashboard.gitguardian.com
