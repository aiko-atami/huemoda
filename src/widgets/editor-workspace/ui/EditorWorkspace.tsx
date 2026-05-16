import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useUnit } from "effector-react";
import {
  $loadedImage,
  formatFileSize,
  imageCleared,
  type LoadedImage,
  releaseLoadedImage,
} from "../../../entities/image";
import { $filterChain, filtersReset, toPixiFilterValues } from "../../../entities/filter-chain";
import { ExportButton } from "../../../features/export-image";
import { ImageUploadButton } from "../../../features/image-upload";
import { FilterPanel } from "../../../features/filter-controls";
import { Button } from "../../../shared/ui";
import type { ExportMimeType, PixiPhotoRenderer } from "../../../shared/lib/pixi/PixiPhotoRenderer";

const PixiCanvas = lazy(async () => {
  const module = await import("./PixiCanvas");

  return { default: module.PixiCanvas };
});

export function EditorWorkspace() {
  const rendererRef = useRef<PixiPhotoRenderer | null>(null);
  const latestImageRef = useRef<LoadedImage | null>(null);
  const [isRendererReady, setIsRendererReady] = useState(false);
  const { filterChain, image, clearImage, resetFilters } = useUnit({
    filterChain: $filterChain,
    image: $loadedImage,
    clearImage: imageCleared,
    resetFilters: filtersReset,
  });
  const pixiFilterValues = toPixiFilterValues(filterChain);

  useEffect(() => {
    latestImageRef.current = image;
  }, [image]);

  useEffect(
    () => () => {
      releaseLoadedImage(latestImageRef.current);
    },
    [],
  );

  const handleRendererReady = useCallback((renderer: PixiPhotoRenderer | null) => {
    rendererRef.current = renderer;
    setIsRendererReady(renderer !== null);
  }, []);

  const handleClearImage = useCallback(() => {
    releaseLoadedImage(image);
    clearImage();
    resetFilters();
  }, [clearImage, image, resetFilters]);

  const exportImage = useCallback(async (mimeType: ExportMimeType) => {
    const renderer = rendererRef.current;

    if (renderer === null) {
      throw new Error("Renderer is not ready");
    }

    return renderer.exportImage({
      mimeType,
      quality: mimeType === "image/jpeg" ? 0.92 : undefined,
    });
  }, []);

  return (
    <section className="editor-shell" aria-label="HueModa photo editor">
      <section className="editor-main">
        <header className="editor-topbar">
          <div className="editor-title">
            <p className="editor-title__eyebrow">HueModa</p>
            <h1>Photo Lab</h1>
          </div>

          <div className="image-meta" aria-live="polite">
            {image === null ? (
              <span>No image loaded</span>
            ) : (
              <>
                <span>{formatFileSize(image.size)}</span>
                <span>{image.type.replace("image/", "").toUpperCase()}</span>
              </>
            )}
          </div>

          <div className="editor-actions">
            <ImageUploadButton variant="compact" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<Trash2 size={16} />}
              onClick={handleClearImage}
              disabled={image === null}
            >
              Clear
            </Button>
            <ExportButton disabled={image === null || !isRendererReady} exportImage={exportImage} />
          </div>
        </header>

        <section className="canvas-stage" aria-label="Image preview">
          <Suspense fallback={<div className="canvas-stage__loading" aria-hidden="true" />}>
            <PixiCanvas
              image={image}
              filterValues={pixiFilterValues}
              onRendererReady={handleRendererReady}
            />
          </Suspense>
          {image === null ? (
            <div className="canvas-empty">
              <ImageUploadButton variant="empty" />
            </div>
          ) : null}
        </section>
      </section>

      <FilterPanel />
    </section>
  );
}
