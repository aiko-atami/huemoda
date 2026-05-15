import { createEvent, createStore } from "effector";

export type LoadedImage = {
  id: string;
  name: string;
  objectUrl: string;
  size: number;
  type: string;
};

export const imageSelected = createEvent<LoadedImage>();
export const imageCleared = createEvent();

export const $loadedImage = createStore<LoadedImage | null>(null)
  .on(imageSelected, (_, image) => image)
  .reset(imageCleared);

export const $canExportImage = $loadedImage.map((image) => image !== null);

export function createLoadedImage(file: File): LoadedImage {
  return {
    id: createImageId(file),
    name: file.name,
    objectUrl: URL.createObjectURL(file),
    size: file.size,
    type: file.type || "image/unknown",
  };
}

export function releaseLoadedImage(image: LoadedImage | null): void {
  if (image !== null) {
    URL.revokeObjectURL(image.objectUrl);
  }
}

export function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function createImageId(file: File): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${file.name}`;
}
