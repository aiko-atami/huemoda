import { Application, Container, Sprite, Texture } from "pixi.js";
import type { Filter } from "pixi.js";
import { createPixiFilters } from "./filterFactory";
import { createEmptyPixiFilterValues, type PixiFilterValues } from "./filterTypes";

export type ExportMimeType = "image/png" | "image/jpeg";

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

dedupeApplicationPlugins();

export class PixiPhotoRenderer {
  private readonly host: HTMLElement;
  private readonly readyPromise: Promise<void>;
  private app: Application | null = null;
  private readonly viewport = new Container();
  private sprite: Sprite | null = null;
  private texture: Texture | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;
  private initialized = false;
  private loadToken = 0;
  private filterValues: PixiFilterValues = createEmptyPixiFilterValues();
  private activeFilters: Filter[] = [];

  constructor(host: HTMLElement) {
    this.host = host;
    this.readyPromise = this.initialize();
  }

  async ready(): Promise<void> {
    await this.readyPromise;
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
      this.render();
      return;
    }

    let image: HTMLImageElement;

    try {
      image = await loadImageElement(objectUrl);
    } catch {
      if (!this.disposed && token === this.loadToken) {
        this.clearSprite();
        this.render();
      }

      return;
    }

    if (this.disposed || token !== this.loadToken) {
      return;
    }

    this.texture = Texture.from(image, true);
    this.sprite = new Sprite(this.texture);
    this.sprite.anchor.set(0.5);
    this.viewport.addChild(this.sprite);
    this.applyFilters();
    this.layoutSprite();
    this.render();
  }

  setFilterValues(filterValues: PixiFilterValues): void {
    this.filterValues = filterValues;

    void this.readyPromise.then(() => {
      if (!this.disposed) {
        this.applyFilters();
        this.render();
      }
    });
  }

  async exportImage(options: ExportOptions): Promise<Blob> {
    await this.readyPromise;

    if (this.app === null || this.texture === null) {
      throw new Error("Nothing to export");
    }

    const exportSprite = new Sprite(this.texture);
    const filters = createPixiFilters(this.filterValues);

    exportSprite.filters = filters;

    const canvas = this.app.renderer.extract.canvas({
      target: exportSprite,
      antialias: true,
      resolution: 1,
      clearColor: "#00000000",
    });

    exportSprite.destroy();
    destroyFilters(filters);

    return canvasToBlob(canvas, options.mimeType, options.quality);
  }

  destroy(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
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
      preference: "webgl",
      powerPreference: "high-performance",
    });

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
    this.render();
  }

  private getHostSize(): { height: number; width: number } {
    const bounds = this.host.getBoundingClientRect();

    return {
      width: Math.max(320, Math.floor(bounds.width || this.host.clientWidth)),
      height: Math.max(280, Math.floor(bounds.height || this.host.clientHeight)),
    };
  }

  private layoutSprite(): void {
    if (this.app === null || this.sprite === null || this.texture === null) {
      return;
    }

    const rendererWidth = this.app.renderer.width;
    const rendererHeight = this.app.renderer.height;
    const padding = Math.min(56, Math.max(24, Math.min(rendererWidth, rendererHeight) * 0.08));
    const availableWidth = Math.max(1, rendererWidth - padding * 2);
    const availableHeight = Math.max(1, rendererHeight - padding * 2);
    const scale = Math.min(
      availableWidth / this.texture.width,
      availableHeight / this.texture.height,
      1,
    );

    this.sprite.scale.set(Math.max(scale, 0.05));
    this.sprite.position.set(rendererWidth / 2, rendererHeight / 2);
  }

  private applyFilters(): void {
    if (this.sprite === null) {
      return;
    }

    destroyFilters(this.activeFilters);
    this.activeFilters = createPixiFilters(this.filterValues);
    this.sprite.filters = this.activeFilters;
  }

  private clearSprite(): void {
    destroyFilters(this.activeFilters);
    this.activeFilters = [];
    this.sprite?.destroy({ texture: true, textureSource: true });
    this.sprite = null;
    this.texture = null;
  }

  private render(): void {
    this.app?.renderer.render({ container: this.app.stage });
  }

  private destroyApp(): void {
    this.app?.destroy(true, { children: true });
    this.app = null;
    this.initialized = false;
  }
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
    return canvas.convertToBlob({ type: mimeType, quality });
  }

  if (canvas.toBlob !== undefined) {
    return new Promise((resolve, reject) => {
      canvas.toBlob?.(
        (blob) => {
          if (blob === null) {
            reject(new Error("Canvas export failed"));
            return;
          }

          resolve(blob);
        },
        mimeType,
        quality,
      );
    });
  }

  if (canvas.toDataURL !== undefined) {
    const response = await fetch(canvas.toDataURL(mimeType, quality));

    return response.blob();
  }

  throw new Error("Canvas export is not supported");
}
