# 🎨 Иконки для всех платформ

## Требуемые файлы

Для полной поддержки всех платформ нужны следующие файлы в корне репозитория:

### ✅ Уже созданы:
- `favicon.svg` - основной фавикон (SVG)
- `site.webmanifest` - манифест PWA
- `safari-pinned-tab.svg` - монохромная версия для Safari

### 📋 Нужно создать:
- `apple-touch-icon.png` - 180×180 для iOS
- `android-chrome-192x192.png` - 192×192 для Android
- `android-chrome-512x512.png` - 512×512 для Android

## Как создать PNG иконки

1. **Откройте `favicon.svg` в любом редакторе**
2. **Экспортируйте в PNG** с размерами:
   - 180×180 → `apple-touch-icon.png`
   - 192×192 → `android-chrome-192x192.png`
   - 512×512 → `android-chrome-512x512.png`

## Тестирование

### Desktop
- **Chrome/Edge/Firefox**: Ctrl+F5, проверьте DevTools → Application → Manifest
- **Safari**: Develop → Empty Caches, проверьте закладки и pinned tabs

### Mobile
- **iOS**: Поделиться → На экран «Домой»
- **Android**: Меню → Добавить на главный экран

## Быстрые подсказки

- Используйте прозрачный фон для PNG
- Добавьте отступ 12-14% для safe area
- Для тёмных тем сделайте иконки светлее
