import type { HighlightColor } from "@better-health/shared";

/**
 * Colours for each metric, and a rotating palette that gives every exercise label its own
 * colour. Full class names are spelled out so Tailwind can find them.
 */
export const metricTone = {
  in: {
    card: "bg-orange-50 ring-orange-200/70",
    icon: "bg-orange-500 text-white",
    text: "text-orange-800",
  },
  out: {
    card: "bg-pink-50 ring-pink-200/70",
    icon: "bg-pink-500 text-white",
    text: "text-pink-800",
  },
  weight: {
    card: "bg-violet-50 ring-violet-200/70",
    icon: "bg-violet-500 text-white",
    text: "text-violet-800",
  },
  steps: {
    card: "bg-teal-50 ring-teal-200/70",
    icon: "bg-teal-600 text-white",
    text: "text-teal-800",
  },
  distance: {
    card: "bg-indigo-50 ring-indigo-200/70",
    icon: "bg-indigo-500 text-white",
    text: "text-indigo-800",
  },
  exercise: {
    card: "bg-sky-50 ring-sky-200/70",
    icon: "bg-sky-500 text-white",
    text: "text-sky-800",
  },
  note: {
    card: "bg-amber-50 ring-amber-200/70",
    icon: "bg-amber-400 text-amber-950",
    text: "text-amber-900",
  },
} as const;

/** Below zero is a deficit (teal), above is a surplus (orange); null or zero is neutral. */
export function netTone(net: number | null) {
  if (net === null || net === 0) {
    return { pill: "bg-slate-100 text-slate-700", card: "bg-muted", text: "text-foreground" };
  }
  return net < 0
    ? {
        pill: "bg-emerald-100 text-emerald-800",
        card: "bg-linear-to-br from-emerald-50 to-teal-100 ring-emerald-200",
        text: "text-emerald-800",
      }
    : {
        pill: "bg-orange-100 text-orange-800",
        card: "bg-linear-to-br from-amber-50 to-orange-100 ring-orange-200",
        text: "text-orange-800",
      };
}

const LABEL_TONES = [
  { dot: "bg-sky-500", chip: "bg-sky-50 text-sky-900 ring-sky-200", on: "bg-sky-700" },
  {
    dot: "bg-fuchsia-500",
    chip: "bg-fuchsia-50 text-fuchsia-900 ring-fuchsia-200",
    on: "bg-fuchsia-600",
  },
  {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    on: "bg-emerald-700",
  },
  {
    dot: "bg-orange-500",
    chip: "bg-orange-50 text-orange-900 ring-orange-200",
    on: "bg-orange-700",
  },
  {
    dot: "bg-violet-500",
    chip: "bg-violet-50 text-violet-900 ring-violet-200",
    on: "bg-violet-600",
  },
  { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-900 ring-rose-200", on: "bg-rose-600" },
] as const;

/** A stable colour for an exercise label, picked by its id. */
export function labelTone(id: number) {
  return LABEL_TONES[Math.abs(id) % LABEL_TONES.length] as (typeof LABEL_TONES)[number];
}

/** Cell backgrounds for calendar highlight rules, and the swatch that picks each one. */
export const highlightTone: Record<HighlightColor, { name: string; cell: string; ring: string }> = {
  red: { name: "Red", cell: "bg-red-200", ring: "ring-red-400" },
  orange: { name: "Orange", cell: "bg-orange-200", ring: "ring-orange-400" },
  yellow: { name: "Yellow", cell: "bg-yellow-200", ring: "ring-yellow-400" },
  green: { name: "Green", cell: "bg-green-200", ring: "ring-green-400" },
  teal: { name: "Teal", cell: "bg-teal-200", ring: "ring-teal-400" },
  blue: { name: "Blue", cell: "bg-blue-200", ring: "ring-blue-400" },
  purple: { name: "Purple", cell: "bg-purple-200", ring: "ring-purple-400" },
  pink: { name: "Pink", cell: "bg-pink-200", ring: "ring-pink-400" },
};
