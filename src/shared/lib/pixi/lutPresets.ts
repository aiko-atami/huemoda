export type LutPresetId = "neutral" | "warmEditorial" | "coolFade";

export type LutPreset = {
  file: string;
  id: LutPresetId;
  label: string;
};

export const LUT_PRESETS: readonly LutPreset[] = [
  { id: "neutral", label: "Neutral", file: "/luts/neutral.png" },
  { id: "warmEditorial", label: "Warm Editorial", file: "/luts/warm-editorial.png" },
  { id: "coolFade", label: "Cool Fade", file: "/luts/cool-fade.png" },
] as const;

export const DEFAULT_LUT_PRESET_ID: LutPresetId = "warmEditorial";
