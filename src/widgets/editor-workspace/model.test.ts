import { allSettled, fork } from "effector";
import { describe, expect, it, vi } from "vitest";
import { imageSelected, releaseImageFx } from "../../entities/image";
import {
  $renderer,
  exportImageFx,
  exportTriggered,
  rendererChanged,
  workspaceUnmounted,
} from "./model";

const fakeImage = {
  id: "test-1",
  name: "test.jpg",
  objectUrl: "blob:test",
  size: 1024,
  type: "image/jpeg",
};

describe("editor workspace model", () => {
  it("does not start export without a loaded image and renderer", async () => {
    const exportSpy = vi.fn();
    const scope = fork({ handlers: [[exportImageFx, exportSpy]] });

    await allSettled(exportTriggered, { scope });

    expect(exportSpy).not.toHaveBeenCalled();
  });

  it("does not start export with only a renderer", async () => {
    const renderer = { exportImage: vi.fn() };
    const exportSpy = vi.fn();
    const scope = fork({ handlers: [[exportImageFx, exportSpy]] });

    await allSettled(rendererChanged, { scope, params: renderer as never });
    await allSettled(exportTriggered, { scope });

    expect(exportSpy).not.toHaveBeenCalled();
  });

  it("clears image and renderer on workspace unmount", async () => {
    const renderer = { exportImage: vi.fn() };
    const releaseSpy = vi.fn();
    const scope = fork({ handlers: [[releaseImageFx, releaseSpy]] });

    await allSettled(imageSelected, { scope, params: fakeImage });
    await allSettled(rendererChanged, { scope, params: renderer as never });
    await allSettled(workspaceUnmounted, { scope });

    expect(scope.getState($renderer)).toBeNull();
    expect(releaseSpy).toHaveBeenCalledWith(fakeImage);
  });
});
