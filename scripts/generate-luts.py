#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["Pillow", "numpy"]
# ///
"""
Generate 64x64x64 LUT PNG textures for the LutFilter.

Layout: 8x8 grid of 64x64 tiles → 512x512 RGBA PNG
  - 64 tiles used (blue slices 0..63)
  - tileX = b_idx % 8, tileY = b_idx // 8
  - within tile: x = r_idx, y = g_idx

Usage:
  uv run scripts/generate-luts.py
"""

import numpy as np
from pathlib import Path
from PIL import Image

LUT_SIZE = 64
TILE_COUNT = 8
TILE_PX = 64           # pixels per tile side (512 / 8)
PNG_SIZE = 512


def make_grid() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return R, G, B grids shaped (LUT_SIZE, LUT_SIZE, LUT_SIZE).

    Grid is indexed [r_idx, g_idx, b_idx] and contains normalised values [0, 1].
    """
    v = np.linspace(0.0, 1.0, LUT_SIZE)
    R, G, B = np.meshgrid(v, v, v, indexing="ij")
    return R, G, B


def pack_png(out_r: np.ndarray, out_g: np.ndarray, out_b: np.ndarray) -> Image.Image:
    """Pack three (LUT_SIZE, LUT_SIZE, LUT_SIZE) arrays into a 512x512 RGBA PNG."""
    img = np.zeros((PNG_SIZE, PNG_SIZE, 4), dtype=np.uint8)
    img[..., 3] = 255

    for b_idx in range(LUT_SIZE):
        tx = b_idx % TILE_COUNT
        ty = b_idx // TILE_COUNT
        x0 = tx * TILE_PX
        y0 = ty * TILE_PX

        # Build one 64x64 RGBA tile (g_idx -> y, r_idx -> x via transpose).
        r = np.clip(out_r[:, :, b_idx].T * 255 + 0.5, 0, 255).astype(np.uint8)
        g = np.clip(out_g[:, :, b_idx].T * 255 + 0.5, 0, 255).astype(np.uint8)
        b = np.clip(out_b[:, :, b_idx].T * 255 + 0.5, 0, 255).astype(np.uint8)
        a = np.full((LUT_SIZE, LUT_SIZE), 255, dtype=np.uint8)

        img[y0 : y0 + TILE_PX, x0 : x0 + TILE_PX] = np.stack([r, g, b, a], axis=-1)

    return Image.fromarray(img, "RGBA")


def curve(x: np.ndarray, lift: float = 0.0, gamma: float = 1.0) -> np.ndarray:
    """Lift-gamma tone curve."""
    x = np.clip(x, 0.0, 1.0) ** (1.0 / gamma)
    x = x * (1.0 - lift) + lift
    return np.clip(x, 0.0, 1.0)


# ── LUT definitions ──────────────────────────────────────────────────────────

def lut_neutral(R: np.ndarray, G: np.ndarray, B: np.ndarray):
    """Identity — output equals input."""
    return R.copy(), G.copy(), B.copy()


def lut_warm_editorial(R: np.ndarray, G: np.ndarray, B: np.ndarray):
    """Warm editorial: lifted shadows, orange-warm midtones, slight blue pull.

    Inspired by film print stocks with a subtle orange grade.
    """
    r = curve(R, lift=0.045, gamma=1.06)
    g = curve(G, lift=0.035, gamma=1.01)
    b = curve(B, lift=0.020, gamma=0.93)

    # Warm push: boost highlights red, pull blue down globally
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    r = np.clip(r + 0.025 * luma, 0.0, 1.0)
    g = np.clip(g + 0.008 * luma, 0.0, 1.0)
    b = np.clip(b - 0.035 * luma, 0.0, 1.0)

    # Split tone: shadow teal hint
    shadow = np.clip(1.0 - luma, 0.0, 1.0) ** 2
    b = np.clip(b + 0.015 * shadow, 0.0, 1.0)
    r = np.clip(r - 0.010 * shadow, 0.0, 1.0)

    return r, g, b


def lut_cool_fade(R: np.ndarray, G: np.ndarray, B: np.ndarray):
    """Cool fade: lifted faded shadows, cool/cyan cast, slight desaturation."""
    r = curve(R, lift=0.07, gamma=0.94)
    g = curve(G, lift=0.06, gamma=1.00)
    b = curve(B, lift=0.05, gamma=1.07)

    # Cool push: boost blue, slight cyan tint
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    r = np.clip(r - 0.030 * (1.0 - luma), 0.0, 1.0)
    g = np.clip(g + 0.008 * (1.0 - luma), 0.0, 1.0)
    b = np.clip(b + 0.045 * (1.0 - luma), 0.0, 1.0)

    # Desaturate 12 %
    luma2 = 0.299 * r + 0.587 * g + 0.114 * b
    sat = 0.88
    r = np.clip(luma2 + sat * (r - luma2), 0.0, 1.0)
    g = np.clip(luma2 + sat * (g - luma2), 0.0, 1.0)
    b = np.clip(luma2 + sat * (b - luma2), 0.0, 1.0)

    return r, g, b


# ── Entry point ──────────────────────────────────────────────────────────────

LUTS = [
    ("neutral", lut_neutral),
    ("warm-editorial", lut_warm_editorial),
    ("cool-fade", lut_cool_fade),
]

OUT_DIR = Path(__file__).parent.parent / "public" / "luts"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    R, G, B = make_grid()

    for name, fn in LUTS:
        out_r, out_g, out_b = fn(R, G, B)
        img = pack_png(out_r, out_g, out_b)
        path = OUT_DIR / f"{name}.png"
        img.save(path, optimize=False)
        print(f"  {path.name}  {img.size[0]}x{img.size[1]}  ({path.stat().st_size // 1024} KB)")

    print(f"\nDone — {len(LUTS)} LUTs written to {OUT_DIR}")


if __name__ == "__main__":
    main()
