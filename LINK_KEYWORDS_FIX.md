# Исправление кеширования Link Keywords

## Проблема

Компонент `SeoKeywordManager` пересчитывал статистику ключевых слов при каждой перезагрузке страницы из-за циклических зависимостей в React hooks.

## Причины

1. **Циклическая зависимость**: `useEffect` с зависимостью от `keywords` вызывал `updateField`, который обновлял `rawFieldValue`, что триггерило синхронизацию состояния, которая снова обновляла `keywords`
2. **Множественные проверки**: Три разных механизма проверки (`lastRecalcSignatureRef`, `statsSignature`, `shouldRecalculate`) конфликтовали между собой
3. **Отсутствие блокировки**: При обновлении поля через `dispatchFields` сразу же срабатывал `useEffect` синхронизации
4. **Некорректная проверка времени**: Сравнение `statsUpdatedAt < recordUpdatedAt` давало ложные срабатывания из-за разницы в миллисекундах при сохранении

## Решение

### 1. Флаг блокировки синхронизации
```typescript
const isUpdatingRef = useRef(false);

const updateField = useCallback((nextState: KeywordState) => {
  isUpdatingRef.current = true;
  // ... обновление
  setTimeout(() => {
    isUpdatingRef.current = false;
  }, 100);
}, [dispatchFields, fieldPath]);
```

### 2. Использование ref вместо state в зависимостях
```typescript
const keywordsRef = useRef(keywords);

useEffect(() => {
  keywordsRef.current = keywords;
}, [keywords]);

// В useEffect пересчета используем keywordsRef.current
// вместо keywords в зависимостях
```

### 3. Единая точка контроля пересчета

```typescript
const lastSavedSignatureRef = useRef<string | null>(initialState.signature);

useEffect(() => {
  if (!shouldRecalculate) return;
  if (lastSavedSignatureRef.current === contentSignature) return;
  // ... пересчет
  lastSavedSignatureRef.current = contentSignature;
  updateField(nextState);
}, [contentSignature, headingTokens, overallTokens, shouldRecalculate, updateField]);
```

### 4. Упрощенная логика shouldRecalculate

```typescript
const shouldRecalculate = useMemo(() => {
  if (!allStatsCached) return true;
  if (hasContentChange) return true;
  return false;
}, [allStatsCached, hasContentChange]);
```

**Удалена** некорректная проверка времени `statsUpdatedAt < recordUpdatedAt`, которая давала ложные срабатывания.

### 5. Синхронизация lastSavedSignatureRef

- При загрузке данных из `rawFieldValue`
- При ручном пересчете через `triggerManualRefresh`
- После успешного сохранения

## Результат
- ✅ Пересчет происходит только при реальном изменении контента
- ✅ Кеш сохраняется корректно в БД
- ✅ Нет циклических обновлений при перезагрузке страницы
- ✅ Ручной пересчет работает корректно

## Тестирование
1. Открыть пост с Link Keywords
2. Обновить страницу - пересчета не должно быть
3. Изменить контент - должен произойти автоматический пересчет
4. Сохранить и перезагрузить - кеш должен сохраниться
5. Нажать "Пересчитать Link Keywords" - должен произойти принудительный пересчет
