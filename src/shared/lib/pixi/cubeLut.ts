import { PROJECT_LUT_ATLAS_SIZE, PROJECT_LUT_SIZE, PROJECT_LUT_TILE_COUNT } from "./lutLayout.ts";

type Rgb = readonly [number, number, number];

export type CubeLut = {
  domainMax: Rgb;
  domainMin: Rgb;
  size: number;
  table: Float32Array;
  title: string | null;
};

export type ProjectLutPixels = {
  data: Uint8ClampedArray;
  height: number;
  width: number;
};

export function parseCubeLut(text: string): CubeLut {
  let size: number | null = null;
  let title: string | null = null;
  let domainMin: Rgb = [0, 0, 0];
  let domainMax: Rgb = [1, 1, 1];
  const values: number[] = [];

  for (const [lineIndex, rawLine] of text.split(/\r?\n/).entries()) {
    const line = stripInlineComment(rawLine).trim();

    if (line.length === 0) {
      continue;
    }

    const [keyword = ""] = line.split(/\s+/, 1);

    if (keyword === "TITLE") {
      title = parseTitle(line);
      continue;
    }

    if (keyword === "LUT_1D_SIZE") {
      throw new Error("1D .cube LUTs are not supported. Upload a 3D LUT with LUT_3D_SIZE.");
    }

    if (keyword === "LUT_3D_SIZE") {
      if (values.length > 0) {
        throw new Error("LUT_3D_SIZE must appear before LUT data.");
      }

      size = parseSize(line, lineIndex);
      continue;
    }

    if (keyword === "DOMAIN_MIN") {
      domainMin = parseRgbDirective(line, "DOMAIN_MIN", lineIndex);
      continue;
    }

    if (keyword === "DOMAIN_MAX") {
      domainMax = parseRgbDirective(line, "DOMAIN_MAX", lineIndex);
      continue;
    }

    const rgb = parseDataRow(line, lineIndex);
    values.push(rgb[0], rgb[1], rgb[2]);
  }

  if (size === null) {
    throw new Error("Missing LUT_3D_SIZE directive.");
  }

  if (domainMax.some((maxValue, index) => maxValue === domainMin[index])) {
    throw new Error("DOMAIN_MAX values must differ from DOMAIN_MIN values.");
  }

  const expectedValueCount = size ** 3 * 3;

  if (values.length !== expectedValueCount) {
    throw new Error(
      `Wrong LUT data count: expected ${expectedValueCount / 3} RGB rows for size ${size}, got ${
        values.length / 3
      }.`,
    );
  }

  return {
    domainMax,
    domainMin,
    size,
    table: Float32Array.from(values),
    title,
  };
}

export function rasterizeCubeToProjectLut(cube: CubeLut): ProjectLutPixels {
  const data = new Uint8ClampedArray(PROJECT_LUT_ATLAS_SIZE * PROJECT_LUT_ATLAS_SIZE * 4);
  const maxIndex = PROJECT_LUT_SIZE - 1;

  for (let b = 0; b < PROJECT_LUT_SIZE; b += 1) {
    const tileX = b % PROJECT_LUT_TILE_COUNT;
    const tileY = Math.floor(b / PROJECT_LUT_TILE_COUNT);
    const xOffset = tileX * PROJECT_LUT_SIZE;
    const yOffset = tileY * PROJECT_LUT_SIZE;

    for (let g = 0; g < PROJECT_LUT_SIZE; g += 1) {
      for (let r = 0; r < PROJECT_LUT_SIZE; r += 1) {
        const sampled = sampleCube(cube, [r / maxIndex, g / maxIndex, b / maxIndex]);
        const pixelIndex = ((yOffset + g) * PROJECT_LUT_ATLAS_SIZE + xOffset + r) * 4;

        data[pixelIndex] = toByte(sampled[0]);
        data[pixelIndex + 1] = toByte(sampled[1]);
        data[pixelIndex + 2] = toByte(sampled[2]);
        data[pixelIndex + 3] = 255;
      }
    }
  }

  return {
    data,
    height: PROJECT_LUT_ATLAS_SIZE,
    width: PROJECT_LUT_ATLAS_SIZE,
  };
}

export function makeProjectLutFilename(fileName: string): string {
  const baseName = fileName.replace(/\.[^/.]+$/, "");

  return `${baseName || "lut"}-huemoda-lut.png`;
}

function stripInlineComment(line: string): string {
  let inQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }

    if (char === "#" && !inQuote) {
      return line.slice(0, index);
    }
  }

  return line;
}

function parseTitle(line: string): string {
  const value = line.slice("TITLE".length).trim();
  const quoted = value.match(/^"(?<title>.*)"$/u);

  return quoted?.groups?.title ?? value;
}

function parseSize(line: string, lineIndex: number): number {
  const parts = line.split(/\s+/);
  const value = Number(parts[1]);

  if (parts.length !== 2 || !Number.isInteger(value) || value < 2) {
    throw new Error(`Invalid LUT_3D_SIZE on line ${lineIndex + 1}.`);
  }

  return value;
}

function parseRgbDirective(line: string, directive: string, lineIndex: number): Rgb {
  const parts = line.split(/\s+/);

  if (parts.length !== 4) {
    throw new Error(`${directive} must contain three numeric values on line ${lineIndex + 1}.`);
  }

  return [
    parseNumber(parts[1], lineIndex),
    parseNumber(parts[2], lineIndex),
    parseNumber(parts[3], lineIndex),
  ];
}

function parseDataRow(line: string, lineIndex: number): Rgb {
  const parts = line.split(/\s+/);

  if (parts.length < 3) {
    throw new Error(`LUT data row on line ${lineIndex + 1} must contain RGB values.`);
  }

  return [
    parseNumber(parts[0], lineIndex),
    parseNumber(parts[1], lineIndex),
    parseNumber(parts[2], lineIndex),
  ];
}

function parseNumber(value: string, lineIndex: number): number {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`Non-numeric RGB value on line ${lineIndex + 1}.`);
  }

  return numberValue;
}

function sampleCube(cube: CubeLut, color: Rgb): Rgb {
  const scaled = color.map((channel, index) =>
    clamp01((channel - cube.domainMin[index]) / (cube.domainMax[index] - cube.domainMin[index])),
  );
  const maxIndex = cube.size - 1;
  const r = scaled[0] * maxIndex;
  const g = scaled[1] * maxIndex;
  const b = scaled[2] * maxIndex;
  const r0 = Math.floor(r);
  const g0 = Math.floor(g);
  const b0 = Math.floor(b);
  const r1 = Math.min(r0 + 1, maxIndex);
  const g1 = Math.min(g0 + 1, maxIndex);
  const b1 = Math.min(b0 + 1, maxIndex);
  const fr = r - r0;
  const fg = g - g0;
  const fb = b - b0;

  return [
    trilinear(cube, 0, r0, r1, g0, g1, b0, b1, fr, fg, fb),
    trilinear(cube, 1, r0, r1, g0, g1, b0, b1, fr, fg, fb),
    trilinear(cube, 2, r0, r1, g0, g1, b0, b1, fr, fg, fb),
  ];
}

function trilinear(
  cube: CubeLut,
  channel: number,
  r0: number,
  r1: number,
  g0: number,
  g1: number,
  b0: number,
  b1: number,
  fr: number,
  fg: number,
  fb: number,
): number {
  const c00 = lerp(
    readCubeValue(cube, r0, g0, b0, channel),
    readCubeValue(cube, r1, g0, b0, channel),
    fr,
  );
  const c10 = lerp(
    readCubeValue(cube, r0, g1, b0, channel),
    readCubeValue(cube, r1, g1, b0, channel),
    fr,
  );
  const c01 = lerp(
    readCubeValue(cube, r0, g0, b1, channel),
    readCubeValue(cube, r1, g0, b1, channel),
    fr,
  );
  const c11 = lerp(
    readCubeValue(cube, r0, g1, b1, channel),
    readCubeValue(cube, r1, g1, b1, channel),
    fr,
  );
  const c0 = lerp(c00, c10, fg);
  const c1 = lerp(c01, c11, fg);

  return lerp(c0, c1, fb);
}

function readCubeValue(cube: CubeLut, r: number, g: number, b: number, channel: number): number {
  return cube.table[(r + cube.size * g + cube.size * cube.size * b) * 3 + channel];
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function toByte(value: number): number {
  return Math.min(255, Math.max(0, Math.floor(value * 255 + 0.5)));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
