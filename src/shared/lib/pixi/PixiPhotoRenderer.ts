import { Application, Assets, Container, Rectangle, RenderTexture, Sprite, Texture } from "pixi.js";
import type { Filter } from "pixi.js";
import {
  createHalationSignalFilters,
  createPixiFilterChain,
  getFilterFingerprint,
  updateFilterUniforms,
  type PixiFilterContext,
  type PixiFilterHandles,
} from "./filterFactory";
import { createEmptyPixiFilterValues, type PixiFilterValues } from "./filterTypes";
import { LUT_PRESETS } from "./lutPresets";
import type { ExportMimeType } from "./exportTypes";

export type PixiRendererBackend = "webgpu" | "webgl2" | "webgl" | "canvas" | "unknown";

type ExportOptions = {
  mimeType: ExportMimeType;
  quality?: number;
};

type ExtractCanvas = {
  convertToBlob?: (options?: { quality?: number; type?: string }) => Promise<Blob>;
  toBlob?: (callback: (blob: Blob | null) => void, type?: string, quality?: number) => void;
  toDataURL?: (type?: string, quality?: number) => string;
};

type PixiApplicationPluginEntry = {
  destroy?: unknown;
  init?: unknown;
  name?: string;
};

type ApplicationWithPlugins = {
  _plugins?: PixiApplicationPluginEntry[];
};

export class PixiPhotoRenderer {
  private readonly host: HTMLElement;
  private readonly readyPromise: Promise<void>;
  private app: Application | null = null;
  private readonly viewport = new Container();
  private sourceSprite: Sprite | null = null;
  private displaySprite: Sprite | null = null;
  private texture: Texture | null = null;
  private filteredTexture: RenderTexture | null = null;
  private halationBaseTexture: RenderTexture | null = null;
  private halationSignalTexture: RenderTexture | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private disposed = false;
  private initialized = false;
  private loadToken = 0;
  private filterValues: PixiFilterValues = createEmptyPixiFilterValues();
  private activeFilters: Filter[] = [];
  private filterHandles: PixiFilterHandles = {};
  private filterFingerprint = "";
  private readonly grainSeed = Math.random();
  private static pluginsDeduped = false;
  private readonly lutTextures = new Map<string, Texture>();

  constructor(host: HTMLElement) {
    if (!PixiPhotoRenderer.pluginsDeduped) {
      dedupeApplicationPlugins();
      PixiPhotoRenderer.pluginsDeduped = true;
    }

    this.host = host;
    this.readyPromise = this.initialize();
  }

  async ready(): Promise<void> {
    await this.readyPromise;
  }

  getRendererBackend(): PixiRendererBackend {
    if (this.app === null) {
      return "unknown";
    }

    return getRendererBackend(this.app.renderer);
  }

  async setImage(objectUrl: string | null): Promise<void> {
    this.loadToken += 1;
    const token = this.loadToken;

    await this.readyPromise;

    if (this.disposed) {
      return;
    }

    this.clearSprite();

    if (objectUrl === null) {
      this.requestRender();
      return;
    }

    let image: HTMLImageElement;

    try {
      image = await loadImageElement(objectUrl);
    } catch {
      if (!this.disposed && token === this.loadToken) {
        this.clearSprite();
        this.requestRender();
      }

      return;
    }

    if (this.disposed || token !== this.loadToken) {
      return;
    }

    this.texture = Texture.from(image, true);
    this.sourceSprite = new Sprite(this.texture);
    this.displaySprite = new Sprite(this.texture);
    this.displaySprite.anchor.set(0.5);
    this.viewport.addChild(this.displaySprite);
    this.applyFilters();
    this.resetViewport();
    this.layoutSprite();
    this.requestRender();
  }

  wheelZoom(deltaY: number, cx: number, cy: number): void {
    this.zoomAt(deltaY < 0 ? 1.1 : 1 / 1.1, cx, cy);
  }

  /**
   * Scale the viewport by an arbitrary `factor` around the focal point
   * (`cx`, `cy`) in host-relative pixels. Used by both wheel zoom (fixed factor
   * per tick) and pinch zoom (continuous factor from finger distance ratio).
   */
  zoomAt(factor: number, cx: number, cy: number): void {
    if (this.displaySprite === null) {
      return;
    }

    const oldZoom = this.viewport.scale.x;
    const newZoom = Math.max(0.5, Math.min(10, oldZoom * factor));

    if (newZoom === oldZoom) {
      return;
    }

    this.viewport.x = cx - ((cx - this.viewport.x) / oldZoom) * newZoom;
    this.viewport.y = cy - ((cy - this.viewport.y) / oldZoom) * newZoom;
    this.viewport.scale.set(newZoom);
    this.clampViewport();
    this.requestRender();
  }

  pan(dx: number, dy: number): void {
    if (this.displaySprite === null) {
      return;
    }

    this.viewport.x += dx;
    this.viewport.y += dy;
    this.clampViewport();
    this.requestRender();
  }

  resetView(): void {
    this.resetViewport();
    this.requestRender();
  }

  setFilterValues(filterValues: PixiFilterValues): void {
    this.filterValues = filterValues;

    if (this.initialized) {
      this.updateFilters();
      this.requestRender();
    } else {
      void this.readyPromise.then(() => {
        if (!this.disposed) {
          this.updateFilters();
          this.requestRender();
        }
      });
    }
  }

  async exportImage(options: ExportOptions): Promise<Blob> {
    await this.readyPromise;

    if (this.app === null || this.texture === null) {
      throw new Error("Nothing to export");
    }

    if (this.filteredTexture === null && this.activeFilters.length > 0) {
      this.updateFilteredTexture();
    }

    const exportSprite = new Sprite(this.filteredTexture ?? this.texture);

    const canvas = this.app.renderer.extract.canvas({
      target: exportSprite,
      antialias: true,
      resolution: 1,
      clearColor: "#00000000",
    });

    exportSprite.destroy();

    return canvasToBlob(canvas, options.mimeType, options.quality);
  }

  destroy(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.clearSprite();

    if (this.initialized) {
      this.destroyApp();
    }
  }

  private async initialize(): Promise<void> {
    const app = new Application();
    const { height, width } = this.getHostSize();

    this.app = app;

    await app.init({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: ["webgpu", "webgl"],
      powerPreference: "high-performance",
      autoStart: false,
    });

    await this.loadLutTextures();

    this.initialized = true;

    if (this.disposed) {
      this.destroyApp();
      return;
    }

    app.canvas.classList.add("pixi-canvas");
    this.host.append(app.canvas);
    app.stage.addChild(this.viewport);

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(this.host);
    this.resize();
  }

  private resize(): void {
    if (this.app === null) {
      return;
    }

    const { height, width } = this.getHostSize();

    this.app.renderer.resize(width, height);
    this.layoutSprite();
    this.requestRender();
  }

  private getHostSize(): { height: number; width: number } {
    const bounds = this.host.getBoundingClientRect();

    return {
      width: Math.max(320, Math.floor(bounds.width || this.host.clientWidth)),
      height: Math.max(280, Math.floor(bounds.height || this.host.clientHeight)),
    };
  }

  private layoutSprite(): void {
    if (this.app === null || this.displaySprite === null || this.texture === null) {
      return;
    }

    const rendererWidth = this.app.screen.width;
    const rendererHeight = this.app.screen.height;
    const padding = Math.min(56, Math.max(24, Math.min(rendererWidth, rendererHeight) * 0.08));
    const availableWidth = Math.max(1, rendererWidth - padding * 2);
    const availableHeight = Math.max(1, rendererHeight - padding * 2);
    const scale = Math.min(
      availableWidth / this.texture.width,
      availableHeight / this.texture.height,
      1,
    );

    this.displaySprite.scale.set(Math.max(scale, 0.05));
    this.displaySprite.position.set(rendererWidth / 2, rendererHeight / 2);
  }

  private updateFilters(): void {
    if (this.sourceSprite === null || this.texture === null) {
      return;
    }

    // Same enabled-set as last build means the chain topology is unchanged, so
    // uniforms can be written in place. Halation is excluded because it bakes a
    // multi-stage pipeline rather than a flat filter chain; `halation.enabled`
    // alone is sufficient (the fingerprint already encodes it, so an equal
    // fingerprint with halation off guarantees both sides are halation-free).
    const nextFingerprint = getFilterFingerprint(this.filterValues);
    const canUpdateInPlace =
      this.filterFingerprint === nextFingerprint && !this.filterValues.halation.enabled;

    if (canUpdateInPlace) {
      updateFilterUniforms(this.filterHandles, this.filterValues, this.getFilterContext());
      this.updateFilteredTexture();
      return;
    }

    this.applyFilters();
  }

  private applyFilters(): void {
    if (this.sourceSprite === null || this.texture === null) {
      return;
    }

    destroyFilters(this.activeFilters);

    const context = this.getFilterContext();
    const fingerprint = getFilterFingerprint(this.filterValues);

    if (this.filterValues.halation.enabled) {
      const { filters: baseFilters } = createPixiFilterChain(this.filterValues, context);
      this.sourceSprite.filters = baseFilters.length > 0 ? baseFilters : null;
      const baseTexture = this.bakeToRenderTexture(this.sourceSprite);
      this.sourceSprite.filters = null;

      const { extract, blur } = createHalationSignalFilters(this.filterValues.halation);
      const signalSprite = new Sprite(baseTexture);
      signalSprite.filters = [extract, blur];
      const signalTexture = this.bakeToRenderTexture(signalSprite);
      signalSprite.destroy();

      const finalStage = new Container();
      const baseSprite = new Sprite(baseTexture);
      const haloSprite = new Sprite(signalTexture);
      haloSprite.blendMode = "screen";
      haloSprite.alpha = getHalationOverlayAlpha(this.filterValues.halation);
      finalStage.addChild(baseSprite, haloSprite);
      const finalTexture = this.bakeToRenderTexture(finalStage);
      finalStage.destroy({ children: true });

      this.displaySprite!.texture = finalTexture;
      this.destroyFilteredTexture();
      this.filteredTexture = finalTexture;
      this.halationBaseTexture?.destroy(true);
      this.halationBaseTexture = baseTexture;
      this.halationSignalTexture?.destroy(true);
      this.halationSignalTexture = signalTexture;
      this.activeFilters = [...baseFilters, extract, blur];
      this.filterHandles = {};
      this.filterFingerprint = fingerprint;
    } else {
      const { filters, handles } = createPixiFilterChain(this.filterValues, context);
      this.activeFilters = filters;
      this.filterHandles = handles;
      this.filterFingerprint = fingerprint;
      this.sourceSprite.filters = this.activeFilters.length > 0 ? this.activeFilters : null;
      this.halationBaseTexture?.destroy(true);
      this.halationBaseTexture = null;
      this.halationSignalTexture?.destroy(true);
      this.halationSignalTexture = null;
      this.updateFilteredTexture();
    }
  }

  private getFilterContext(): PixiFilterContext {
    return {
      width: this.texture?.width ?? 0,
      height: this.texture?.height ?? 0,
      lutTextures: this.lutTextures,
      grainSeed: this.grainSeed,
    };
  }

  private bakeToRenderTexture(target: Container): RenderTexture {
    return this.app!.renderer.textureGenerator.generateTexture({
      target,
      frame: new Rectangle(0, 0, this.texture!.width, this.texture!.height),
      resolution: 1,
      antialias: true,
      clearColor: "#00000000",
    });
  }

  private resetViewport(): void {
    this.viewport.x = 0;
    this.viewport.y = 0;
    this.viewport.scale.set(1);
  }

  private clampViewport(): void {
    if (this.displaySprite === null || this.app === null || this.texture === null) {
      return;
    }

    const rw = this.app.screen.width;
    const rh = this.app.screen.height;
    const vz = this.viewport.scale.x;

    // Половина размера спрайта на экране
    const hw = (this.texture.width * this.displaySprite.scale.x * vz) / 2;
    const hh = (this.texture.height * this.displaySprite.scale.y * vz) / 2;

    // Минимальный overlap: хотя бы столько пикселей изображения должно
    // оставаться видимым при смещении к краю экрана
    const overlapX = Math.max(60, hw * 0.25);
    const overlapY = Math.max(60, hh * 0.25);

    // Центр спрайта в экранных координатах
    const scx = this.viewport.x + this.displaySprite.x * vz;
    const scy = this.viewport.y + this.displaySprite.y * vz;

    const clampedScx = Math.max(overlapX - hw, Math.min(rw - overlapX + hw, scx));
    const clampedScy = Math.max(overlapY - hh, Math.min(rh - overlapY + hh, scy));

    this.viewport.x = clampedScx - this.displaySprite.x * vz;
    this.viewport.y = clampedScy - this.displaySprite.y * vz;
  }

  private clearSprite(): void {
    destroyFilters(this.activeFilters);
    this.activeFilters = [];
    this.filterHandles = {};
    this.filterFingerprint = "";
    this.sourceSprite?.destroy();
    this.displaySprite?.destroy();
    this.destroyFilteredTexture();
    this.halationBaseTexture?.destroy(true);
    this.halationBaseTexture = null;
    this.halationSignalTexture?.destroy(true);
    this.halationSignalTexture = null;
    this.texture?.destroy(true);
    this.sourceSprite = null;
    this.displaySprite = null;
    this.texture = null;
  }

  private updateFilteredTexture(): void {
    if (
      this.app === null ||
      this.sourceSprite === null ||
      this.displaySprite === null ||
      this.texture === null
    ) {
      return;
    }

    if (this.activeFilters.length === 0) {
      this.displaySprite.texture = this.texture;
      this.destroyFilteredTexture();
      return;
    }

    const nextTexture = this.app.renderer.textureGenerator.generateTexture({
      target: this.sourceSprite,
      frame: new Rectangle(0, 0, this.texture.width, this.texture.height),
      resolution: 1,
      antialias: true,
      clearColor: "#00000000",
    });

    this.displaySprite.texture = nextTexture;
    this.destroyFilteredTexture();
    this.filteredTexture = nextTexture;
  }

  private destroyFilteredTexture(): void {
    this.filteredTexture?.destroy(true);
    this.filteredTexture = null;
  }

  /**
   * Render immediately on the current call stack. Use only when the result must
   * be readable synchronously right after (e.g. export pixel extraction).
   * Interactive paths should use `requestRender()` to coalesce to one render
   * per animation frame.
   */
  private renderNow(): void {
    this.app?.renderer.render({ container: this.app.stage });
  }

  /**
   * Schedule a single render on the next animation frame. Multiple calls within
   * the same frame collapse into one GPU render — pan + zoom from a single pinch
   * event, or a burst of filter updates from a slider drag, render only once.
   */
  private requestRender(): void {
    if (this.rafId !== null || this.app === null) {
      return;
    }

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.renderNow();
    });
  }

  private destroyApp(): void {
    this.app?.destroy(true, { children: true });
    this.lutTextures.clear();
    this.app = null;
    this.initialized = false;
  }

  private async loadLutTextures(): Promise<void> {
    const results = await Promise.allSettled(
      LUT_PRESETS.map(async (preset) => {
        const texture = await Assets.load<Texture>({
          src: preset.file,
          data: null,
        });

        if (!texture.source) {
          throw new Error(`[LUT] No source for preset "${preset.id}"`);
        }

        texture.source.style.scaleMode = "linear";
        texture.source.style.addressMode = "clamp-to-edge";
        texture.source.autoGenerateMipmaps = false;
        texture.source.style.update();
        texture.source.update();

        return { presetId: preset.id, texture };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        this.lutTextures.set(result.value.presetId, result.value.texture);
      } else {
        console.warn("[LUT] Failed to load preset:", result.reason);
      }
    }
  }
}

type RendererBackendProbe = {
  context?: { webGLVersion?: number };
  gl?: unknown;
  gpu?: unknown;
};

function getRendererBackend(renderer: unknown): PixiRendererBackend {
  const probe = renderer as RendererBackendProbe;

  if (probe.gpu !== undefined) {
    return "webgpu";
  }

  if (probe.context?.webGLVersion === 2) {
    return "webgl2";
  }

  if (probe.context?.webGLVersion === 1 || probe.gl !== undefined) {
    return "webgl";
  }

  if (renderer !== null && typeof renderer === "object") {
    const constructorName = renderer.constructor.name.toLowerCase();

    if (constructorName.includes("canvas")) {
      return "canvas";
    }
  }

  return "unknown";
}

async function loadImageElement(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  const loadPromise = waitForImageLoad(image);

  image.decoding = "async";
  image.src = source;

  if (image.decode !== undefined) {
    try {
      await image.decode();
      return image;
    } catch {
      return loadPromise;
    }
  }

  return loadPromise;
}

function waitForImageLoad(image: HTMLImageElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load"));
  });
}

function getHalationOverlayAlpha(values: PixiFilterValues["halation"]): number {
  const gain = 0.5 + values.backgroundGain * 0.5;
  const strength =
    values.impact * (0.35 + values.amplify * 1.65) * gain * (1 + values.blueComp * 0.5);

  return Math.max(0, Math.min(1, strength));
}

function destroyFilters(filters: Filter[]): void {
  for (const filter of filters) {
    filter.destroy();
  }
}

function dedupeApplicationPlugins(): void {
  const applicationClass = Application as unknown as ApplicationWithPlugins;
  const plugins = applicationClass._plugins;

  if (plugins === undefined) {
    return;
  }

  const seen = new Set<string | PixiApplicationPluginEntry>();

  applicationClass._plugins = plugins.filter((plugin) => {
    const key = plugin.name ?? plugin;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

async function canvasToBlob(
  canvas: ExtractCanvas,
  mimeType: ExportMimeType,
  quality?: number,
): Promise<Blob> {
  if (canvas.convertToBlob !== undefined) {
    const blob = await canvas.convertToBlob({ type: mimeType, quality });

    return validateExportBlob(blob, mimeType);
  }

  if (canvas.toBlob !== undefined) {
    return new Promise((resolve, reject) => {
      canvas.toBlob?.(
        (blob) => {
          if (blob === null) {
            reject(new Error("Canvas export failed"));
            return;
          }

          try {
            resolve(validateExportBlob(blob, mimeType));
          } catch (error) {
            reject(error);
          }
        },
        mimeType,
        quality,
      );
    });
  }

  if (canvas.toDataURL !== undefined) {
    const response = await fetch(canvas.toDataURL(mimeType, quality));

    return validateExportBlob(await response.blob(), mimeType);
  }

  throw new Error("Canvas export is not supported");
}

function validateExportBlob(blob: Blob, mimeType: ExportMimeType): Blob {
  if (mimeType === "image/webp" && blob.type !== "image/webp") {
    throw new Error("Canvas WebP export is not supported");
  }

  return blob;
}
