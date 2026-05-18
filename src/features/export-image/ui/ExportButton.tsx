import { useCallback, useId, useState } from "react";
import { Download } from "lucide-react";
import { useUnit } from "effector-react";
import { $loadedImage } from "../../../entities/image";
import { downloadBlob } from "../../../shared/lib/download";
import type { ExportMimeType } from "../../../shared/lib/pixi/PixiPhotoRenderer";
import { Button } from "../../../shared/ui";
import { buildExportFilename } from "../lib/buildExportFilename";

type ExportButtonProps = {
  disabled: boolean;
  exportImage: (mimeType: ExportMimeType) => Promise<Blob>;
};

export function ExportButton({ disabled, exportImage }: ExportButtonProps) {
  const formatSelectId = useId();
  const image = useUnit($loadedImage);
  const [format, setFormat] = useState<ExportMimeType>("image/webp");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (image === null || disabled || isExporting) {
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const blob = await exportImage(format);
      downloadBlob(blob, buildExportFilename(image.name, format));
    } catch {
      setError("Export failed");
    } finally {
      setIsExporting(false);
    }
  }, [disabled, exportImage, format, image, isExporting]);

  return (
    <div className="export-control">
      <select
        id={formatSelectId}
        className="format-select"
        aria-label="Export format"
        name="export-format"
        value={format}
        onChange={(event) => setFormat(event.target.value as ExportMimeType)}
        disabled={disabled || isExporting}
      >
        <option value="image/webp">WebP</option>
        <option value="image/png">PNG</option>
        <option value="image/jpeg">JPEG</option>
      </select>
      <Button
        type="button"
        variant="primary"
        size="sm"
        icon={<Download size={16} />}
        onClick={handleExport}
        disabled={disabled || isExporting}
      >
        {isExporting ? "Exporting" : "Export"}
      </Button>
      {error === null ? null : (
        <span className="export-control__error" role="status">
          {error}
        </span>
      )}
    </div>
  );
}
