import { attach, combine, createEffect, createEvent, createStore, sample } from "effector";
import type { LoadedImage } from "../../entities/image";
import { $loadedImage, imageCleared } from "../../entities/image";
import { buildExportFilename } from "../../shared/lib/exportFilename";
import { downloadBlob } from "../../shared/lib/download";
import type { PixiPhotoRenderer } from "../../shared/lib/pixi/PixiPhotoRenderer";
import type { ExportMimeType } from "../../shared/lib/pixi/exportTypes";

// ---------------------------------------------------------------------------
// Renderer lifecycle
// ---------------------------------------------------------------------------

export const rendererChanged = createEvent<PixiPhotoRenderer | null>();
export const workspaceUnmounted = createEvent();

export const $renderer = createStore<PixiPhotoRenderer | null>(null)
  .on(rendererChanged, (_, renderer) => renderer)
  .reset(workspaceUnmounted);

export const $isRendererReady = $renderer.map((r) => r !== null);

sample({ clock: workspaceUnmounted, target: imageCleared });

// ---------------------------------------------------------------------------
// Export format
// ---------------------------------------------------------------------------

export const exportFormatChanged = createEvent<ExportMimeType>();

export const $exportFormat = createStore<ExportMimeType>("image/webp").on(
  exportFormatChanged,
  (_, format) => format,
);

// ---------------------------------------------------------------------------
// Export effect
// ---------------------------------------------------------------------------

export const exportTriggered = createEvent();

export const $canExport = combine(
  { renderer: $renderer, image: $loadedImage },
  ({ renderer, image }) => renderer !== null && image !== null,
);

type ExportParams = {
  renderer: PixiPhotoRenderer;
  image: LoadedImage;
  format: ExportMimeType;
};

const rawExportFx = createEffect(async ({ renderer, image, format }: ExportParams) => {
  const blob = await renderer.exportImage({
    mimeType: format,
    quality: format === "image/jpeg" ? 0.92 : undefined,
  });

  downloadBlob(blob, buildExportFilename(image.name, format));
});

// Attaches source stores so callers pass no params.
export const exportImageFx = attach({
  source: { renderer: $renderer, image: $loadedImage, format: $exportFormat },
  effect: rawExportFx,
  mapParams: (_, { renderer, image, format }) => {
    if (renderer === null || image === null) {
      throw new Error("Export requires a loaded image and ready renderer");
    }

    return { renderer, image, format };
  },
});

export const $isExporting = exportImageFx.pending;

export const $exportError = createStore<string | null>(null)
  .on(exportImageFx.fail, (_, { error }) =>
    error instanceof Error ? error.message : "Export failed",
  )
  .reset(exportTriggered);

sample({ clock: exportTriggered, filter: $canExport, target: exportImageFx });
