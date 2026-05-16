#!/usr/bin/env node
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { parseCubeLut, rasterizeCubeToProjectLut } from "../src/shared/lib/pixi/cubeLut.ts";

type CliOptions = {
  input: string;
  name: string | null;
  output: string;
};

type ConvertTarget = {
  inputPath: string;
  outputPath: string;
};

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const DEFAULT_INPUT = ".cube";
const DEFAULT_OUTPUT = "public/luts";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const targets = await resolveTargets(options);

  if (targets.length === 0) {
    throw new Error(`No .cube files found in ${options.input}.`);
  }

  for (const target of targets) {
    const source = await readFile(target.inputPath, "utf8");
    const cube = parseCubeLut(source);
    const pixels = rasterizeCubeToProjectLut(cube);
    const png = encodePngRgba(pixels.width, pixels.height, pixels.data);

    await mkdir(path.dirname(target.outputPath), { recursive: true });
    await writeFile(target.outputPath, png);
    console.log(
      `${path.relative(process.cwd(), target.inputPath)} -> ${path.relative(
        process.cwd(),
        target.outputPath,
      )} (${cube.size}^3)`,
    );
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    input: DEFAULT_INPUT,
    name: null,
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--input" || arg === "-i") {
      options.input = readOptionValue(args, (index += 1), arg);
      continue;
    }

    if (arg === "--output" || arg === "-o") {
      options.output = readOptionValue(args, (index += 1), arg);
      continue;
    }

    if (arg === "--name" || arg === "-n") {
      options.name = readOptionValue(args, (index += 1), arg);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function readOptionValue(args: string[], index: number, flag: string): string {
  const value = args[index];

  if (value === undefined || value.startsWith("-")) {
    throw new Error(`${flag} expects a value.`);
  }

  return value;
}

async function resolveTargets(options: CliOptions): Promise<ConvertTarget[]> {
  const inputPath = path.resolve(options.input);
  const outputPath = path.resolve(options.output);
  const inputStats = await stat(inputPath);

  if (inputStats.isDirectory()) {
    if (options.name !== null) {
      throw new Error("--name can only be used when --input points to one .cube file.");
    }

    const files = await readdir(inputPath);
    return files
      .filter((file) => file.toLowerCase().endsWith(".cube"))
      .sort((left, right) => left.localeCompare(right))
      .map((file) => {
        const basename = file.replace(/\.[^/.]+$/u, "");

        return {
          inputPath: path.join(inputPath, file),
          outputPath: path.join(outputPath, `${slugify(basename)}.png`),
        };
      });
  }

  if (!inputPath.toLowerCase().endsWith(".cube")) {
    throw new Error("--input must point to a .cube file or a directory with .cube files.");
  }

  const outputIsPng = outputPath.toLowerCase().endsWith(".png");
  const basename = options.name ?? path.basename(inputPath).replace(/\.[^/.]+$/u, "");

  return [
    {
      inputPath,
      outputPath: outputIsPng ? outputPath : path.join(outputPath, `${slugify(basename)}.png`),
    },
  ];
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .replace(/([a-z\d])([A-Z])/gu, "$1-$2")
    .toLowerCase()
    .replace(/rec\s*709/gu, "rec709")
    .replace(/[^a-z\d]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return slug || "lut";
}

function encodePngRgba(width: number, height: number, rgba: Uint8ClampedArray): Buffer {
  const rowByteLength = width * 4;
  const raw = Buffer.alloc((rowByteLength + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rawRowStart = y * (rowByteLength + 1);
    const rgbaRowStart = y * rowByteLength;

    raw[rawRowStart] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + rgbaRowStart, rowByteLength).copy(
      raw,
      rawRowStart + 1,
    );
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    makeChunk("IHDR", makeIhdr(width, height)),
    makeChunk("IDAT", deflateSync(raw)),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIhdr(width: number, height: number): Buffer {
  const data = Buffer.alloc(13);

  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;

  return data;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function printHelp(): void {
  console.log(`Usage:
  pnpm run convert:luts
  pnpm run convert:luts -- --input .cube --output public/luts
  pnpm run convert:luts -- --input .cube/Atikan.cube --output public/luts --name atikan

Options:
  -i, --input   .cube file or directory with .cube files (default: ${DEFAULT_INPUT})
  -o, --output  output PNG file or directory (default: ${DEFAULT_OUTPUT})
  -n, --name    output file basename for single-file conversion`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
