/**
 * The 32 colours users pick from for calendar cell values and highlight rules: 16 hues, each
 * soft (a pale tint, named by the hue alone) and bold (a strong shade). The soft ones keep the
 * names highlight rules used before there were 32. Every pairing passes WCAG AA contrast.
 */
export const PALETTE_COLORS = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "red-bold",
  "orange-bold",
  "amber-bold",
  "yellow-bold",
  "lime-bold",
  "green-bold",
  "emerald-bold",
  "teal-bold",
  "cyan-bold",
  "sky-bold",
  "blue-bold",
  "indigo-bold",
  "violet-bold",
  "purple-bold",
  "fuchsia-bold",
  "pink-bold",
] as const;
export type PaletteColor = (typeof PALETTE_COLORS)[number];
