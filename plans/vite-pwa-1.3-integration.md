# План внедрения VitePWA 1.3 в HueModa

## Summary

- Использовать `vite-plugin-pwa` как Vite-compatible plugin в текущем `vite.config.ts`.
- Цель первого этапа: сделать HueModa installable PWA с offline app shell.
- Не кэшировать пользовательские изображения через service worker: изображения остаются local-first ресурсами браузера, управляемыми через IndexedDB/OPFS позже.
- Для проекта это подходит: у тебя SPA на Vite-compatible toolchain, клиентский Pixi renderer, local-first направление и нет backend-зависимости.

## Key Changes

- Установить dev dependency:
  - `vp add -D vite-plugin-pwa`
  - Если нужна строго версия 1.3.x: `vp add -D vite-plugin-pwa@1.3.0` или актуальный `1.3.x` после проверки registry.
- В `vite.config.ts` добавить:
  - `import { VitePWA } from "vite-plugin-pwa";`
  - plugin после React/Babel plugin’ов.
- Рекомендуемая стартовая конфигурация:
  - `registerType: "autoUpdate"`
  - `injectRegister: "auto"`
  - `includeAssets: ["favicon.svg", "pwa-192x192.png", "pwa-512x512.png", "apple-touch-icon.png"]`
  - `manifest` с `name`, `short_name`, `description`, `theme_color`, `background_color`, `display: "standalone"`, `start_url: "/"`, `scope: "/"`.
- Добавить PWA icons в `public/`:
  - `pwa-192x192.png`
  - `pwa-512x512.png`
  - `apple-touch-icon.png`
  - опционально `maskable-icon-512x512.png`.
- В `index.html` добавить только безопасные meta-теги:
  - `theme-color`
  - `apple-mobile-web-app-capable`
  - `apple-mobile-web-app-title`
  - не добавлять ручной manifest link, если его генерирует VitePWA.

## PWA Strategy

- Для первого релиза использовать generated service worker, не custom SW.
- Precache должен покрывать:
  - HTML shell;
  - JS/CSS chunks;
  - favicon/icons;
  - статические assets, нужные для загрузки приложения.
- Runtime caching на первом этапе держать минимальным:
  - не кэшировать blob/object URLs;
  - не кэшировать пользовательские загруженные изображения;
  - не добавлять агрессивное кэширование external/CDN, если их нет.
- Offline behavior:
  - после первого успешного открытия приложение должно запускаться без сети;
  - редактор может открыться пустым;
  - ранее выбранные изображения восстанавливать только после отдельного local-first storage этапа.

## Architecture Fit

- PWA bootstrap остаётся в `app`/Vite config, не в `features`.
- Service worker registration — инфраструктура приложения, не бизнес-фича.
- Local-first хранение проектов позже добавлять отдельно:
  - `entities/project` или `entities/draft`;
  - `shared/lib/storage` для IndexedDB/OPFS adapters;
  - Effector effects для save/load/delete draft.
- Текущий Pixi rendering не ломать:
  - service worker не должен пытаться управлять runtime image lifecycle;
  - object URL lifecycle остаётся через существующие Effector effects.

## Test Plan

- После внедрения запустить:
  - `vp check`
  - `vp test`
  - `vp build`
- Проверить build output:
  - появился web manifest;
  - появился service worker;
  - assets попали в precache.
- Локально проверить production preview:
  - `vp build`
  - `vp preview`
  - открыть DevTools → Application → Manifest / Service Workers.
- Проверить сценарии:
  - приложение installable;
  - после первого визита открывается offline;
  - upload image работает как раньше;
  - export image работает как раньше;
  - обновление приложения подтягивается через auto update.

## Assumptions

- Под “VitePWA 1.3” имеется в виду пакет `vite-plugin-pwa` версии `1.3.x`.
- Текущий `vite-plus` config совместим с обычными Vite plugins.
- Первый PWA этап — installability/offline shell, без сохранения проектов.
- Local-first drafts/images будут отдельным следующим этапом через IndexedDB/OPFS, а не через service worker cache.
