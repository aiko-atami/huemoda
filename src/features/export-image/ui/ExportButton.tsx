import { useCallback, useState } from "react";
import { Download } from "lucide-react";
import { useUnit } from "effector-react";
import { $loadedImage } from "../../../entities/image/model";
import { downloadBlob } from "../../../shared/lib/download";
import type { ExportMimeType } from "../../../shared/lib/pixi/PixiPhotoRenderer";
import { Button } from "../../../shared/ui";

type ExportButtonProps = {
  disabled: boolean;
  exportImage: (mimeType: ExportMimeType) => Promise<Blob>;
};

export function ExportButton({ disabled, exportImage }: ExportButtonProps) {
  const image = useUnit($loadedImage);
  const [format, setFormat] = useState<ExportMimeType>("image/png");
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
        className="format-select"
        aria-label="Export format"
        value={format}
        onChange={(event) => setFormat(event.target.value as ExportMimeType)}
        disabled={disabled || isExporting}
      >
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

function buildExportFilename(name: string, mimeType: ExportMimeType): string {
  const extension = mimeType === "image/jpeg" ? "jpg" : "png";
  const basename =
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "image";

  return `huemoda-${basename}.${extension}`;
}
