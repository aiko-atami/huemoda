# PixiJS Lean Barrel — план внедрения

## Проблема

PixiJS v8 barrel (`lib/index.mjs`) содержит **23 bare-импорта** init-файлов, каждый из которых регистрирует подсистему через `extensions.add()`. Barrel и все init-файлы помечены в `sideEffects[]` — бандлер обязан их исполнять, даже если ни один экспорт не используется.

```
import { Sprite } from "pixi.js"
  → lib/index.mjs (sideEffects)
    → import './scene/graphics/init.mjs'   → GraphicsContext, GraphicsPipe (+54K)
    → import './scene/text-bitmap/init.mjs' → BitmapFont, BitmapTextPipe (+33K)
    → import './scene/text/init.mjs'       → Text, CanvasTextPipe (+30K)
    → import './scene/text-html/init.mjs'  → HTMLText (+15K)
    → import './scene/mesh/init.mjs'       → Mesh (+8K)
    → import './app/init.mjs'             → TickerPlugin → Ticker (+8K)
    → import './accessibility/init.mjs'   → Accessibility (+10K)
    → import './dom/init.mjs'             → DOMPipe (+5K)
    → import './events/init.mjs'          → EventSystem (+12K)
    → import './scene/particle-container/init.mjs' → Particles (+8K)
    → ... ещё 13 init-файлов
```

**Итог:** ~200K raw (~60-70K gzipped) мёртвого кода в бандле. Проект использует только:
- `Application`, `Container`, `Sprite`, `Texture`, `RenderTexture`, `Rectangle`, `Assets`
- `Filter`, `GlProgram`, `GpuProgram`
- `TexturePool`, `Color`, `ImageSource`, `DEG_TO_RAD`, `ObservablePoint`, `deprecation` (из pixi-filters)
- `Extract`, `GenerateTexture` (через `app.renderer.extract`, `app.renderer.textureGenerator`)

## Почему tree-shaking не помогает

PixiJS v8 **не имеет** sub-path экспортов для классов. `exports` в package.json — только для init-файлов (регистрация расширений), не для классов. Нельзя написать:

```ts
import { Sprite } from "pixi.js/lib/scene/sprite/Sprite.mjs"  // заблокировано exports field
```

`sideEffects` список также включает barrel (`./lib/index.*`), что заставляет бандлер исполнять все bare-импорты.

## Решение: Lean barrel через Vite resolve.alias

Создать свой barrel-файл, который реэкспортирует только нужные классы из внутренних путей PixiJS, и зарегистрировать только необходимые расширения. Vite alias обходит `exports` restrictions.

### Шаг 1: Создать `src/shared/lib/pixi/pixi-lean.ts`

Файл реэкспортирует классы из внутренних путей PixiJS. Каждый путь — это реальный файл в `node_modules/pixi.js/lib/`.

```ts
// --- Core ---
export { Application } from "pixi.js/lib/app/Application.mjs";
export { ResizePlugin } from "pixi.js/lib/app/ResizePlugin.mjs";

// --- Scene ---
export { Container } from "pixi.js/lib/scene/container/Container.mjs";
export { Sprite } from "pixi.js/lib/scene/sprite/Sprite.mjs";
export { SpritePipe } from "pixi.js/lib/scene/sprite/SpritePipe.mjs";

// --- Rendering ---
export { Rectangle } from "pixi.js/lib/maths/shapes/Rectangle.mjs";
export { Texture } from "pixi.js/lib/rendering/renderers/shared/texture/Texture.mjs";
export { RenderTexture } from "pixi.js/lib/rendering/renderers/shared/texture/RenderTexture.mjs";
export { GlProgram } from "pixi.js/lib/rendering/renderers/gl/shader/GlProgram.mjs";
export { GpuProgram } from "pixi.js/lib/rendering/renderers/gpu/shader/GpuProgram.mjs";
export { Filter } from "pixi.js/lib/filters/Filter.mjs";
export { FilterPipe } from "pixi.js/lib/filters/FilterPipe.mjs";
export { FilterSystem } from "pixi.js/lib/filters/FilterSystem.mjs";

// --- Assets ---
export { Assets, AssetsClass } from "pixi.js/lib/assets/Assets.mjs";

// --- Extras (нужны pixi-filters) ---
export { TexturePool, TexturePoolClass } from "pixi.js/lib/rendering/renderers/shared/texture/TexturePool.mjs";
export { Color } from "pixi.js/lib/color/Color.mjs";
export { ImageSource } from "pixi.js/lib/rendering/renderers/shared/texture/sources/ImageSource.mjs";
export { DEG_TO_RAD, RAD_TO_DEG } from "pixi.js/lib/maths/misc/const.mjs";
export { ObservablePoint } from "pixi.js/lib/maths/point/ObservablePoint.mjs";
export { deprecation } from "pixi.js/lib/utils/logging/deprecation.mjs";

// --- Extensions API ---
export { extensions, ExtensionType } from "pixi.js/lib/extensions/Extensions.mjs";
```

> **Внимание:** Точный список внутренних путей нужно верифицировать. PixiJS может рефакторить внутреннюю структуру между минорными версиями. Зафиксировать pixi.js точную версию в package.json (убрать `^`).

### Шаг 2: Создать `src/shared/lib/pixi/pixi-lean-init.ts`

Регистрирует **только** нужные расширения. Это ключевая часть — без неё рендерер не будет знать как рисовать Sprite или применять Filter.

```ts
import { extensions } from "pixi.js/lib/extensions/Extensions.mjs";

// 1. Browser environment (обязателен для WebGL)
import "pixi.js/lib/environment-browser/browserAll.mjs"; // sideEffects: OK — минимальный набор

// 2. Rendering init (WebGL renderer, mask pipes, batcher, extract, generateTexture)
import "pixi.js/lib/rendering/init.mjs";

// 3. Filter init (FilterPipe, FilterSystem, AlphaMask, ColorMask, StencilMask)
import "pixi.js/lib/filters/init.mjs";

// 4. Assets init (loaders, resolvers, cache — для Assets.load)
import "pixi.js/lib/assets/index.mjs";

// 5. Sprite rendering pipe (без этого Sprite не рисуется)
import { SpritePipe } from "pixi.js/lib/scene/sprite/SpritePipe.mjs";
extensions.add(SpritePipe);

// 6. Application plugins — только ResizePlugin!
// TickerPlugin НЕ нужен — проект вызывает app.render() вручную
import { ResizePlugin } from "pixi.js/lib/app/ResizePlugin.mjs";
extensions.add(ResizePlugin);
```

> **Критично:** `browserAll.mjs` тоже в `sideEffects[]` — он регистрирует environment adapter. Без него `autoDetectRenderer` не работает. Но он маленький (~150 bytes).

### Шаг 3: Обновить `vite.config.ts`

```ts
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "styled-system": path.resolve(import.meta.dirname, "styled-system"),
      "pixi.js": path.resolve(import.meta.dirname, "src/shared/lib/pixi/pixi-lean.ts"),
    },
  },
  // ...
});
```

Vite alias перезаписывает резолв `"pixi.js"` для ВСЕХ импортов — и в исходниках проекта, и в `node_modules/pixi-filters/lib/**/*.mjs`. Это важно: pixi-filters импортируют `Filter, GpuProgram, GlProgram` и т.д. из `"pixi.js"`, и alias подставит lean barrel.

### Шаг 4: Импортировать init в точке входа

В файле где создаётся `PixiPhotoRenderer` (или в `src/shared/lib/pixi/index.ts`), добавить:

```ts
import "./pixi-lean-init";
```

Это должно выполниться **до** создания `new Application()`.

### Шаг 5: Верификация

1. `pnpm build` — убедиться что бандл собирается без ошибок
2. Открыть приложение — проверить что:
   - Canvas рендерится
   - Загрузка изображения работает
   - Все 16 фильтров применяются корректно
   - Zoom/pan работает
   - Export изображения работает
   - LUT-текстуры загружаются
3. Сравнить размер бандла до/после (gzipped)
4. Проверить что мёртвые модули исчезли:

```bash
rg -o 'GraphicsContext|BitmapFont|CanvasRenderer|Ticker[^P]|AccessibilitySystem|EventSystem|DOMPipe|MeshPipe' dist/assets/*.js
```

Должно вернуть пустой результат или значительно меньше совпадений.

---

## Подводные камни

### 1. Внутренние пути могут меняться

PixiJS не гарантирует стабильность внутренней структуры `lib/`. При обновлении `pixi.js` пути могут измениться. **Митигация:** зафиксировать версию pixi.js в package.json (убрать `^`), или написать скрипт проверки путей.

### 2. pixi-filters тянут больше API чем ожидается

Полный список того, что pixi-filters импортируют из `"pixi.js"`:

| Фильтр | Импорты из pixi.js |
|--------|-------------------|
| AdjustmentFilter | `Filter, GpuProgram, GlProgram` |
| KawaseBlurFilter | `Filter, deprecation, GpuProgram, GlProgram, TexturePool` |
| AdvancedBloomFilter | `Filter, GpuProgram, GlProgram, Texture, TexturePool` |
| GlowFilter | `Filter, GpuProgram, GlProgram, Color` |
| DotFilter | `Filter, deprecation, GpuProgram, GlProgram` |
| GlitchFilter | `Filter, GpuProgram, GlProgram, Texture, ImageSource, DEG_TO_RAD` |
| MotionBlurFilter | `Filter, ObservablePoint, deprecation, GpuProgram, GlProgram` |
| SimplexNoiseFilter | `Filter, GpuProgram, GlProgram` |
| ZoomBlurFilter | `Filter, GpuProgram, GlProgram` |
| ColorOverlayFilter | `Filter, deprecation, GpuProgram, GlProgram, Color` |

`deprecation` и `Color` — не критичные модули, но их нужно реэкспортировать из lean barrel. `TexturePool` используется KawaseBlur и AdvancedBloom для multi-pass рендеринга.

### 3. Application.init() вызывает `_plugins`

`app.init()` итерирует `Application._plugins` и вызывает `plugin.init()` для каждого. Если TickerPlugin не зарегистрирован, `app.ticker` будет `undefined` — это нормально, проект его не использует. Но нужно убедиться что нет кода который обращается к `app.ticker`.

### 4. `rendering/init.mjs` может тянуть лишнее

Нужно проверить что именно он регистрирует. Он необходим (WebGL renderer, mask pipes, batcher, extract, generateTexture), но может включать CanvasRenderer-related системы. Если CanvasRenderer системы весят много — можно попробовать импортировать только нужные подсистемы напрямую вместо `rendering/init.mjs`.

### 5. `assets/index.mjs` может тянуть загрузчики видео/шрифтов

Проект грузит только PNG-текстуры (LUT). Assets init может включать loadVideoTextures, loadWebFont и т.д. Если они весят значимо — можно попробовать импортировать только `loadTextures` + `Cache` + `Resolver` напрямую.

---

## Ожидаемый результат

| Метрика | До | После (оценка) |
|---------|-----|---------------|
| Главный чанк (raw) | 1,122 KB | ~900-950 KB |
| Главный чанк (gzip) | 336 KB | ~265-280 KB |
| Экономия gzip | — | **~55-70 KB** |

Мёртвые модули которые должны исчезнуть:
- GraphicsContext + GraphicsPipe (~54K raw)
- BitmapFont + BitmapTextPipe (~33K raw)
- Text + CanvasTextPipe (~30K raw)
- HTMLText (~15K raw)
- CanvasRenderer systems (~26K raw)
- Ticker (~8K raw)
- Accessibility (~10K raw)
- DOM (~5K raw)
- Events (~12K raw)
- Mesh (~8K raw)
- ParticleContainer (~8K raw)

---

## Порядок внедрения (рекомендуемый)

1. **Зафиксировать версию pixi.js** — убрать `^` из package.json, чтобы внутренние пути не сломались при обновлении
2. **Создать pixi-lean.ts** — сначала минимальный набор (Application, Container, Sprite, Texture, Filter, GlProgram, GpuProgram)
3. **Создать pixi-lean-init.ts** — минимальный набор расширений
4. **Добавить alias в vite.config.ts**
5. **pnpm build** — проверить что собирается
6. **Добавить недостающие экспорты** — если при сборке ошибки "not exported from pixi-lean", добавить нужные пути
7. **Протестировать вручную** — рендеринг, фильтры, export, zoom/pan, LUT
8. **Измерить бандл** — сравнить до/после
9. **Убедиться что мёртвый код исчез** — rg по бандлу
10. **При обновлении pixi.js** — верифицировать что внутренние пути не изменились

---

## Альтернатива: Vite manualChunks

Вместо alias можно попробовать `build.rollupOptions.output.manualChunks` чтобы отделить PixiJS в отдельный чанк и.lazy-load его. Это не уменьшит общий размер, но улучшит initial load. Менее инвазивный вариант, но не решает проблему мёртвого кода.

## Альтернатива: Отправить PR в PixiJS

PixiJS v8 мог бы добавить granular sub-path exports для классов:

```json
{
  "exports": {
    ".": "./lib/index.mjs",
    "./sprite": "./lib/scene/sprite/index.mjs",
    "./filter": "./lib/filters/index.mjs",
    "./assets": "./lib/assets/index.mjs",
    ...
  }
}
```

Это решило бы проблему для всех пользователей. Но это долгосрочный путь — PR, ревью, релиз.
