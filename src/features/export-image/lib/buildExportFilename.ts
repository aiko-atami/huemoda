import type { ExportMimeType } from "../../../shared/lib/pixi/PixiPhotoRenderer";

const EXPORT_EXTENSIONS: Record<ExportMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function buildExportFilename(name: string, mimeType: ExportMimeType): string {
  const basename =
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "image";

  return `huemoda-${basename}.${EXPORT_EXTENSIONS[mimeType]}`;
}
