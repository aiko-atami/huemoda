import { describe, expect, it } from "vitest";
import { buildExportFilename } from "./buildExportFilename";

describe("buildExportFilename", () => {
  it.each([
    ["image.png", "image/png", "huemoda-image.png"],
    ["portrait.jpeg", "image/jpeg", "huemoda-portrait.jpg"],
    ["edited photo.tiff", "image/webp", "huemoda-edited-photo.webp"],
  ] as const)("maps %s exported as %s to %s", (name, mimeType, filename) => {
    expect(buildExportFilename(name, mimeType)).toBe(filename);
  });
});
