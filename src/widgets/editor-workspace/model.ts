import { attach, createEffect, createEvent, createStore, sample } from "effector";
import type { LoadedImage } from "../../entities/image";
import { $loadedImage } from "../../entities/image";
import { buildExportFilename } from "../../features/export-image";
import { downloadBlob } from "../../shared/lib/download";
import type { ExportMimeType, PixiPhotoRenderer } from "../../shared/lib/pixi";

// ---------------------------------------------------------------------------
// Renderer lifecycle
// ---------------------------------------------------------------------------

export const rendererChanged = createEvent<PixiPhotoRenderer | null>();

export const $renderer = createStore<PixiPhotoRenderer | null>(null).on(
  rendererChanged,
  (_, renderer) => renderer,
);

export const $isRendererReady = $renderer.map((r) => r !== null);

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

type ExportParams = {
  renderer: PixiPhotoRenderer | null;
  image: LoadedImage | null;
  format: ExportMimeType;
};

const rawExportFx = createEffect(async ({ renderer, image, format }: ExportParams) => {
  if (renderer === null) throw new Error("Renderer not ready");

  const blob = await renderer.exportImage({
    mimeType: format,
    quality: format === "image/jpeg" ? 0.92 : undefined,
  });

  downloadBlob(blob, buildExportFilename(image?.name ?? "export", format));
});

// Attaches source stores so callers pass no params.
export const exportImageFx = attach({
  source: { renderer: $renderer, image: $loadedImage, format: $exportFormat },
  effect: rawExportFx,
});

export const $isExporting = exportImageFx.pending;

export const $exportError = createStore<string | null>(null)
  .on(exportImageFx.fail, (_, { error }) =>
    error instanceof Error ? error.message : "Export failed",
  )
  .reset(exportTriggered);

// Trigger export only when renderer is ready.
sample({ clock: exportTriggered, filter: $isRendererReady, target: exportImageFx });
