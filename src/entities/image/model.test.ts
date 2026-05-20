import { allSettled, fork } from "effector";
import { describe, expect, it, vi } from "vitest";
import { $loadedImage, imageCleared, imageSelected, releaseImageFx } from "./model";

const makeImage = (id: string) => ({
  id,
  name: `${id}.jpg`,
  objectUrl: `blob:${id}`,
  size: 512,
  type: "image/jpeg",
});

describe("image model", () => {
  it("stores the selected image", async () => {
    const scope = fork();
    const img = makeImage("a");

    await allSettled(imageSelected, { scope, params: img });

    expect(scope.getState($loadedImage)).toEqual(img);
  });

  it("resets $loadedImage when imageCleared fires", async () => {
    const scope = fork();

    await allSettled(imageSelected, { scope, params: makeImage("a") });
    await allSettled(imageCleared, { scope });

    expect(scope.getState($loadedImage)).toBeNull();
  });

  it("releases the previous image URL when a new image is selected", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const scope = fork();
    const imgA = makeImage("a");
    const imgB = makeImage("b");

    // First selection — no previous image, nothing to release yet.
    await allSettled(imageSelected, { scope, params: imgA });
    expect(revoke).not.toHaveBeenCalled();

    // Second selection — imgA's URL should be revoked.
    await allSettled(imageSelected, { scope, params: imgB });
    expect(revoke).toHaveBeenCalledWith(imgA.objectUrl);

    revoke.mockRestore();
  });

  it("releases the current image URL when imageCleared fires", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const scope = fork({
      handlers: [
        [releaseImageFx, (img: { objectUrl: string }) => URL.revokeObjectURL(img.objectUrl)],
      ],
    });
    const img = makeImage("c");

    await allSettled(imageSelected, { scope, params: img });
    await allSettled(imageCleared, { scope });

    expect(revoke).toHaveBeenCalledWith(img.objectUrl);

    revoke.mockRestore();
  });
});
