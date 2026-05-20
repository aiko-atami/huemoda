import { Download } from "lucide-react";
import { css } from "styled-system/css";
import type { ExportMimeType } from "../../../shared/lib/pixi";
import { Button, SelectControl } from "../../../shared/ui";

type ExportButtonProps = {
  disabled: boolean;
  error: string | null;
  format: ExportMimeType;
  isExporting: boolean;
  onExport: () => void;
  onFormatChange: (format: ExportMimeType) => void;
};

const FORMAT_OPTIONS: readonly { label: string; value: ExportMimeType }[] = [
  { label: "WebP", value: "image/webp" },
  { label: "PNG", value: "image/png" },
  { label: "JPEG", value: "image/jpeg" },
];

const wrapperClass = css({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  "@media (max-width: 560px)": {
    width: "100%",
  },
});

const errorClass = css({
  position: "absolute",
  top: "calc(100% + 6px)",
  right: "0",
  padding: "4px 7px",
  border: "1px solid",
  borderColor: "danger",
  borderRadius: "sm",
  background: "surface.highest",
  color: "danger",
  fontSize: "11px",
  whiteSpace: "nowrap",
});

const exportTriggerClass = css({
  "@media (max-width: 560px)": {
    flex: "0 0 78px",
    minWidth: "0",
  },
});

export function ExportButton({
  disabled,
  error,
  format,
  isExporting,
  onExport,
  onFormatChange,
}: ExportButtonProps) {
  return (
    <div className={wrapperClass}>
      <SelectControl
        aria-label="Export format"
        options={FORMAT_OPTIONS}
        value={format}
        onValueChange={(v) => onFormatChange(v as ExportMimeType)}
        disabled={disabled || isExporting}
        triggerClassName={exportTriggerClass}
      />
      <Button
        type="button"
        variant="primary"
        size="sm"
        icon={<Download size={16} />}
        onClick={onExport}
        disabled={disabled || isExporting}
      >
        {isExporting ? "Exporting" : "Export"}
      </Button>
      {error === null ? null : (
        <span className={errorClass} role="status">
          {error}
        </span>
      )}
    </div>
  );
}
