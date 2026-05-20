import { allSettled, fork } from "effector";
import { describe, expect, it } from "vitest";
import { filterAdded, $filterChain } from "../entities/filter-chain";
import { imageCleared, imageSelected } from "../entities/image";
// Import app/model to ensure the sample wiring is registered.
import "./model";

const fakeImage = {
  id: "test-1",
  name: "test.jpg",
  objectUrl: "blob:test",
  size: 1024,
  type: "image/jpeg",
};

describe("app model wiring", () => {
  it("clears the filter chain when imageCleared fires", async () => {
    const scope = fork();

    // Load image, then add a filter.
    await allSettled(imageSelected, { scope, params: fakeImage });
    await allSettled(filterAdded, { scope, params: "grain" });
    expect(scope.getState($filterChain).grain.added).toBe(true);

    // Clear the image — filters should reset.
    await allSettled(imageCleared, { scope });
    expect(scope.getState($filterChain).grain.added).toBe(false);
  });

  it("preserves filters when the image is replaced", async () => {
    const scope = fork();

    await allSettled(imageSelected, { scope, params: fakeImage });
    await allSettled(filterAdded, { scope, params: "blur" });
    expect(scope.getState($filterChain).blur.added).toBe(true);

    // Replace with a different image.
    const replacementImage = { ...fakeImage, id: "test-2", name: "other.jpg" };
    await allSettled(imageSelected, { scope, params: replacementImage });

    // Filters must be preserved.
    expect(scope.getState($filterChain).blur.added).toBe(true);
  });
});
