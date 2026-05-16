export type LutPreset = {
  file: string;
  id: string;
  label: string;
};

export const LUT_PRESETS = [
  { id: "neutral", label: "Neutral", file: "/luts/neutral.png" },
  { id: "warmEditorial", label: "Warm Editorial", file: "/luts/warm-editorial.png" },
  { id: "coolFade", label: "Cool Fade", file: "/luts/cool-fade.png" },
  { id: "kodak2383", label: "Kodak 2383", file: "/luts/kodak_2383.png" },
  { id: "negative100c", label: "100c Negative", file: "/luts/100c-negative.png" },
  { id: "atikan", label: "Atikan", file: "/luts/atikan.png" },
  { id: "darkum", label: "Darkum", file: "/luts/darkum.png" },
  { id: "choiHungEstate", label: "Choi Hung Estate", file: "/luts/choi-hung-estate.png" },
  {
    id: "coolNaturalBreeze",
    label: "Cool Natural Breeze",
    file: "/luts/cool-natural-breeze.png",
  },
  { id: "goldenYears", label: "Golden Years", file: "/luts/golden-years.png" },
  { id: "g2Film", label: "G2 Film", file: "/luts/g2-film.png" },
  { id: "mergaRec709", label: "Merga Rec709", file: "/luts/merga-rec709.png" },
  { id: "samKolder", label: "Sam Kolder", file: "/luts/sam-kolder.png" },
  { id: "tealOrange2", label: "Teal Orange 2", file: "/luts/teal-orange-2.png" },
  { id: "luck", label: "Luck", file: "/luts/luck.png" },
] as const satisfies readonly LutPreset[];

export type LutPresetId = (typeof LUT_PRESETS)[number]["id"];

export const DEFAULT_LUT_PRESET_ID: LutPresetId = "warmEditorial";
