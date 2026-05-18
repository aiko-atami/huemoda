import { useCallback, useState } from "react";
import { Download } from "lucide-react";
import { useUnit } from "effector-react";
import { $loadedImage } from "../../../entities/image";
import { downloadBlob } from "../../../shared/lib/download";
import type { ExportMimeType } from "../../../shared/lib/pixi";
import { Button, SelectControl } from "../../../shared/ui";
import { buildExportFilename } from "../lib/buildExportFilename";

type ExportButtonProps = {
  disabled: boolean;
  exportImage: (mimeType: ExportMimeType) => Promise<Blob>;
};

const FORMAT_OPTIONS: readonly { label: string; value: ExportMimeType }[] = [
  { label: "WebP", value: "image/webp" },
  { label: "PNG", value: "image/png" },
  { label: "JPEG", value: "image/jpeg" },
];

export function ExportButton({ disabled, exportImage }: ExportButtonProps) {
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
      <SelectControl
        aria-label="Export format"
        options={FORMAT_OPTIONS}
        value={format}
        onValueChange={(v) => setFormat(v as ExportMimeType)}
        disabled={disabled || isExporting}
      />
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
