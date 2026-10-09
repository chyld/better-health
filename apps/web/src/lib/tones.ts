/** Colours for each metric. Full class names are spelled out so Tailwind can find them. */
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
