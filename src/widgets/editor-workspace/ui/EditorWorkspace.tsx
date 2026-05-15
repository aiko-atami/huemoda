import { useCallback, useRef, useState } from "react";
import { ImageIcon, RotateCcw, SlidersHorizontal, Sparkles, Trash2 } from "lucide-react";
import { useUnit } from "effector-react";
import {
  $loadedImage,
  formatFileSize,
  imageCleared,
  releaseLoadedImage,
} from "../../../entities/image/model";
import {
  $filterChain,
  filtersReset,
  toPixiFilterValues,
} from "../../../entities/filter-chain/model";
import { ExportButton } from "../../../features/export-image";
import { ImageUploadButton } from "../../../features/image-upload";
import { FilterPanel } from "../../../features/filter-controls";
import { Button } from "../../../shared/ui";
import { PixiPhotoRenderer, type ExportMimeType } from "../../../shared/lib/pixi/PixiPhotoRenderer";
import { PixiCanvas } from "./PixiCanvas";

export function EditorWorkspace() {
  const rendererRef = useRef<PixiPhotoRenderer | null>(null);
  const [isRendererReady, setIsRendererReady] = useState(false);
  const { filterChain, image, clearImage, resetFilters } = useUnit({
    filterChain: $filterChain,
    image: $loadedImage,
    clearImage: imageCleared,
    resetFilters: filtersReset,
  });
  const pixiFilterValues = toPixiFilterValues(filterChain);

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
      <aside className="tool-rail" aria-label="Tool rail">
        <div className="brand-mark" aria-label="HueModa">
          HM
        </div>
        <div className="tool-rail__icons" aria-hidden="true">
          <ImageIcon size={20} />
          <SlidersHorizontal size={20} />
          <Sparkles size={20} />
        </div>
      </aside>

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
                <span className="image-meta__name">{image.name}</span>
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<RotateCcw size={16} />}
              onClick={resetFilters}
            >
              Reset
            </Button>
            <ExportButton disabled={image === null || !isRendererReady} exportImage={exportImage} />
          </div>
        </header>

        <section className="canvas-stage" aria-label="Image preview">
          <PixiCanvas
            image={image}
            filterValues={pixiFilterValues}
            onRendererReady={handleRendererReady}
          />
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
