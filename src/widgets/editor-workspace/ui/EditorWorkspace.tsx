import { Suspense, lazy, useCallback, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { useUnit } from "effector-react";
import { css } from "styled-system/css";
import { $loadedImage, formatFileSize, imageCleared } from "../../../entities/image";
import { $pixiFilterValues } from "../../../entities/filter-chain";
import { ExportButton } from "../../../features/export-image";
import { ImageUploadButton } from "../../../features/image-upload";
import { FilterPanel } from "../../../features/filter-controls";
import { Button } from "../../../shared/ui";
import type { PixiPhotoRenderer } from "../../../shared/lib/pixi";
import {
  $exportError,
  $exportFormat,
  $isExporting,
  $canExport,
  exportFormatChanged,
  exportTriggered,
  rendererChanged,
  workspaceUnmounted,
} from "../model";

const metaContainerClass = css({
  display: "flex",
  minWidth: "0",
  flexWrap: "wrap",
  gap: "6px",
  justifyContent: "center",
  color: "text.dim",
  "@media (max-width: 900px)": {
    justifyContent: "flex-start",
  },
});

const metaChipClass = css({
  minWidth: "0",
  maxWidth: "220px",
  overflow: "hidden",
  padding: "3px 8px",
  border: "1px solid",
  borderColor: "outline",
  borderRadius: "full",
  background: "surface",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const PixiCanvas = lazy(async () => {
  const module = await import("./PixiCanvas");

  return { default: module.PixiCanvas };
});

export function EditorWorkspace() {
  const {
    image,
    clearImage,
    exportError,
    exportFormat,
    isExporting,
    canExport,
    onExport,
    onFormatChange,
    onRendererChanged,
    onWorkspaceUnmounted,
    pixiFilterValues,
  } = useUnit({
    image: $loadedImage,
    clearImage: imageCleared,
    exportError: $exportError,
    exportFormat: $exportFormat,
    isExporting: $isExporting,
    canExport: $canExport,
    onExport: exportTriggered,
    onFormatChange: exportFormatChanged,
    onRendererChanged: rendererChanged,
    onWorkspaceUnmounted: workspaceUnmounted,
    pixiFilterValues: $pixiFilterValues,
  });

  useEffect(() => () => onWorkspaceUnmounted(), [onWorkspaceUnmounted]);

  const handleRendererReady = useCallback(
    (renderer: PixiPhotoRenderer | null) => {
      onRendererChanged(renderer);
    },
    [onRendererChanged],
  );

  const handleClearImage = useCallback(() => {
    clearImage();
  }, [clearImage]);

  return (
    <section className="editor-shell" aria-label="HueModa photo editor">
      <section className="editor-main">
        <header className="editor-topbar">
          <div className="editor-title">
            <h1>Photo Lab</h1>
          </div>

          <div className={metaContainerClass} aria-live="polite">
            {image === null ? (
              <span className={metaChipClass}>No image loaded</span>
            ) : (
              <>
                <span className={metaChipClass}>{formatFileSize(image.size)}</span>
                <span className={metaChipClass}>
                  {image.type.replace("image/", "").toUpperCase()}
                </span>
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
            <ExportButton
              disabled={!canExport}
              error={exportError}
              format={exportFormat}
              isExporting={isExporting}
              onExport={onExport}
              onFormatChange={onFormatChange}
            />
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
