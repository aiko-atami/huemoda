import { describe, expect, it } from "vitest";
import { PROJECT_LUT_ATLAS_SIZE } from "../../../shared/lib/pixi";
import { parseCubeLut, rasterizeCubeToProjectLut } from "./cubeLut";

function identityCube(size: number): string {
  const rows: string[] = [`LUT_3D_SIZE ${size}`];
  const maxIndex = size - 1;

  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        rows.push(`${r / maxIndex} ${g / maxIndex} ${b / maxIndex}`);
      }
    }
  }

  return rows.join("\n");
}

function pixelAt(data: Uint8ClampedArray, x: number, y: number): number[] {
  const index = (y * PROJECT_LUT_ATLAS_SIZE + x) * 4;

  return Array.from(data.slice(index, index + 4));
}

describe("cube LUT conversion", () => {
  it("maps a LUT_3D_SIZE 2 identity cube to expected atlas pixels", () => {
    const cube = parseCubeLut(identityCube(2));
    const pixels = rasterizeCubeToProjectLut(cube);

    expect(pixels.width).toBe(512);
    expect(pixels.height).toBe(512);
    expect(pixelAt(pixels.data, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(pixels.data, 63, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(pixels.data, 0, 63)).toEqual([0, 255, 0, 255]);
    expect(pixelAt(pixels.data, 511, 511)).toEqual([255, 255, 255, 255]);
  });

  it.each([17, 33, 64])("resamples LUT_3D_SIZE %i to a 512x512 atlas", (size) => {
    const cube = parseCubeLut(identityCube(size));
    const pixels = rasterizeCubeToProjectLut(cube);

    expect(pixels.width).toBe(512);
    expect(pixels.height).toBe(512);
    expect(pixels.data).toHaveLength(512 * 512 * 4);
    expect(pixelAt(pixels.data, 511, 511)).toEqual([255, 255, 255, 255]);
  });

  it("parses comments, TITLE, and domain lines", () => {
    const cube = parseCubeLut(`# comment
TITLE "Film Print"
DOMAIN_MIN -1 0 0.25
DOMAIN_MAX 1 2 1.25
LUT_3D_SIZE 2
0 0 0 # black
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`);

    expect(cube.title).toBe("Film Print");
    expect(cube.domainMin).toEqual([-1, 0, 0.25]);
    expect(cube.domainMax).toEqual([1, 2, 1.25]);
  });

  it("rejects missing LUT_3D_SIZE", () => {
    expect(() => parseCubeLut("0 0 0\n1 1 1")).toThrow(/Missing LUT_3D_SIZE/u);
  });

  it("rejects unsupported 1D LUTs", () => {
    expect(() => parseCubeLut("LUT_1D_SIZE 2\n0 0 0\n1 1 1")).toThrow(/1D .cube LUTs/u);
  });

  it("rejects the wrong data count", () => {
    expect(() => parseCubeLut("LUT_3D_SIZE 2\n0 0 0")).toThrow(/Wrong LUT data count/u);
  });

  it("rejects non-numeric RGB values", () => {
    expect(() => parseCubeLut("LUT_3D_SIZE 2\nred 0 0")).toThrow(/Non-numeric RGB value/u);
  });
});
