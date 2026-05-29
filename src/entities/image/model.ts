import { createEffect, createEvent, createStore, sample } from "effector";

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

// Effect that revokes an object URL when a LoadedImage is no longer needed.
export const releaseImageFx = createEffect<LoadedImage, void>((image) => {
  URL.revokeObjectURL(image.objectUrl);
});

// Tracks the image that was loaded before the current one so we can release its URL.
// This store intentionally has no .on handlers — it is updated via sample after
// $loadedImage has already advanced, so it always lags one step behind.
const $prevLoadedImage = createStore<LoadedImage | null>(null);

// When a new image is selected and there was already one loaded, release the old URL.
sample({ clock: imageSelected, source: $prevLoadedImage, filter: Boolean, target: releaseImageFx });
// When the image is cleared, release the current URL.
sample({ clock: imageCleared, source: $prevLoadedImage, filter: Boolean, target: releaseImageFx });

// Advance the prev pointer to the value $loadedImage just updated to.
sample({ clock: imageSelected, source: $loadedImage, target: $prevLoadedImage });
// Reset the prev pointer on clear.
sample({ clock: imageCleared, fn: (): null => null, target: $prevLoadedImage });

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

export { formatFileSize } from "../../shared/lib/format";

function createImageId(file: File): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${file.name}`;
}
