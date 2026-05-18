export {
  makeProjectLutFilename,
  parseCubeLut,
  rasterizeCubeToProjectLut,
  type CubeLut,
  type ProjectLutPixels,
} from "../../../shared/lib/pixi";
import { rasterizeCubeToProjectLut, type CubeLut } from "../../../shared/lib/pixi";

export async function convertCubeToProjectLutPng(cube: CubeLut): Promise<Blob> {
  const pixels = rasterizeCubeToProjectLut(cube);
  const canvas = document.createElement("canvas");
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const context = canvas.getContext("2d");

  if (context === null) {
    throw new Error("Could not create a 2D canvas context.");
  }

  const imageData = context.createImageData(pixels.width, pixels.height);
  imageData.data.set(pixels.data);
  context.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error("Could not encode PNG."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}
