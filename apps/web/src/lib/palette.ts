import type { PaletteColor } from "@better-health/shared";

/**
 * Classes for each palette colour: `pill` for a value on a calendar cell, `cell` and `ring` for
 * a highlighted day. Soft colours are pale tints with dark text; bold ones are strong shades with
 * white text. Full class names are spelled out so Tailwind can find them.
 */
export const paletteTone: Record<
  PaletteColor,
  { name: string; pill: string; cell: string; ring: string }
> = {
  red: { name: "Red", pill: "bg-red-100 text-red-800", cell: "bg-red-200", ring: "ring-red-400" },
  orange: {
    name: "Orange",
    pill: "bg-orange-100 text-orange-800",
    cell: "bg-orange-200",
    ring: "ring-orange-400",
  },
  amber: {
    name: "Amber",
    pill: "bg-amber-100 text-amber-800",
    cell: "bg-amber-200",
    ring: "ring-amber-400",
  },
  yellow: {
    name: "Yellow",
    pill: "bg-yellow-100 text-yellow-800",
    cell: "bg-yellow-200",
    ring: "ring-yellow-400",
  },
  lime: {
    name: "Lime",
    pill: "bg-lime-100 text-lime-800",
    cell: "bg-lime-200",
    ring: "ring-lime-400",
  },
  green: {
    name: "Green",
    pill: "bg-green-100 text-green-800",
    cell: "bg-green-200",
    ring: "ring-green-400",
  },
  emerald: {
    name: "Emerald",
    pill: "bg-emerald-100 text-emerald-800",
    cell: "bg-emerald-200",
    ring: "ring-emerald-400",
  },
  teal: {
    name: "Teal",
    pill: "bg-teal-100 text-teal-800",
    cell: "bg-teal-200",
    ring: "ring-teal-400",
  },
  cyan: {
    name: "Cyan",
    pill: "bg-cyan-100 text-cyan-800",
    cell: "bg-cyan-200",
    ring: "ring-cyan-400",
  },
  sky: { name: "Sky", pill: "bg-sky-100 text-sky-800", cell: "bg-sky-200", ring: "ring-sky-400" },
  blue: {
    name: "Blue",
    pill: "bg-blue-100 text-blue-800",
    cell: "bg-blue-200",
    ring: "ring-blue-400",
  },
  indigo: {
    name: "Indigo",
    pill: "bg-indigo-100 text-indigo-800",
    cell: "bg-indigo-200",
    ring: "ring-indigo-400",
  },
  violet: {
    name: "Violet",
    pill: "bg-violet-100 text-violet-800",
    cell: "bg-violet-200",
    ring: "ring-violet-400",
  },
  purple: {
    name: "Purple",
    pill: "bg-purple-100 text-purple-800",
    cell: "bg-purple-200",
    ring: "ring-purple-400",
  },
  fuchsia: {
    name: "Fuchsia",
    pill: "bg-fuchsia-100 text-fuchsia-800",
    cell: "bg-fuchsia-200",
    ring: "ring-fuchsia-400",
  },
  pink: {
    name: "Pink",
    pill: "bg-pink-100 text-pink-800",
    cell: "bg-pink-200",
    ring: "ring-pink-400",
  },
  "red-bold": {
    name: "Red, bold",
    pill: "bg-red-700 text-white",
    cell: "bg-red-400",
    ring: "ring-red-600",
  },
  "orange-bold": {
    name: "Orange, bold",
    pill: "bg-orange-700 text-white",
    cell: "bg-orange-400",
    ring: "ring-orange-600",
  },
  "amber-bold": {
    name: "Amber, bold",
    pill: "bg-amber-700 text-white",
    cell: "bg-amber-400",
    ring: "ring-amber-600",
  },
  "yellow-bold": {
    name: "Yellow, bold",
    pill: "bg-yellow-700 text-white",
    cell: "bg-yellow-400",
    ring: "ring-yellow-600",
  },
  "lime-bold": {
    name: "Lime, bold",
    pill: "bg-lime-700 text-white",
    cell: "bg-lime-400",
    ring: "ring-lime-600",
  },
  "green-bold": {
    name: "Green, bold",
    pill: "bg-green-700 text-white",
    cell: "bg-green-400",
    ring: "ring-green-600",
  },
  "emerald-bold": {
    name: "Emerald, bold",
    pill: "bg-emerald-700 text-white",
    cell: "bg-emerald-400",
    ring: "ring-emerald-600",
  },
  "teal-bold": {
    name: "Teal, bold",
    pill: "bg-teal-700 text-white",
    cell: "bg-teal-400",
    ring: "ring-teal-600",
  },
  "cyan-bold": {
    name: "Cyan, bold",
    pill: "bg-cyan-700 text-white",
    cell: "bg-cyan-400",
    ring: "ring-cyan-600",
  },
  "sky-bold": {
    name: "Sky, bold",
    pill: "bg-sky-700 text-white",
    cell: "bg-sky-400",
    ring: "ring-sky-600",
  },
  "blue-bold": {
    name: "Blue, bold",
    pill: "bg-blue-700 text-white",
    cell: "bg-blue-400",
    ring: "ring-blue-600",
  },
  "indigo-bold": {
    name: "Indigo, bold",
    pill: "bg-indigo-700 text-white",
    cell: "bg-indigo-400",
    ring: "ring-indigo-600",
  },
  "violet-bold": {
    name: "Violet, bold",
    pill: "bg-violet-700 text-white",
    cell: "bg-violet-400",
    ring: "ring-violet-600",
  },
  "purple-bold": {
    name: "Purple, bold",
    pill: "bg-purple-700 text-white",
    cell: "bg-purple-400",
    ring: "ring-purple-600",
  },
  "fuchsia-bold": {
    name: "Fuchsia, bold",
    pill: "bg-fuchsia-700 text-white",
    cell: "bg-fuchsia-400",
    ring: "ring-fuchsia-600",
  },
  "pink-bold": {
    name: "Pink, bold",
    pill: "bg-pink-700 text-white",
    cell: "bg-pink-400",
    ring: "ring-pink-600",
  },
};
