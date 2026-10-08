import {
  type CellField,
  type CellFieldCreate,
  type CellFieldPatch,
  type CellMetric,
  type ExerciseType,
  formatAmount,
  formatCompact,
  formatNumber,
  formatWeight,
} from "@better-health/shared";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";
import { paletteTone } from "@/lib/palette";
import { labelTone, metricTone, netTone } from "@/lib/tones";

/** What the user's calendar cells show, in order. */
export const cellFieldsQuery = queryOptions({
  queryKey: ["cell-fields"],
  queryFn: (): Promise<CellField[]> => unwrap(api["cell-fields"].$get()),
});

export function useCellFieldMutations() {
  const queryClient = useQueryClient();
  const write = (fields: CellField[]) => queryClient.setQueryData(cellFieldsQuery.queryKey, fields);
  return {
    create: useMutation({
      mutationFn: (json: CellFieldCreate) => unwrap(api["cell-fields"].$post({ json })),
      onSuccess: write,
    }),
    update: useMutation({
      mutationFn: ({ id, ...json }: CellFieldPatch & { id: number }) =>
        unwrap(api["cell-fields"][":id"].$patch({ param: { id: String(id) }, json })),
      onSuccess: write,
    }),
    remove: useMutation({
      mutationFn: (id: number) =>
        unwrap(api["cell-fields"][":id"].$delete({ param: { id: String(id) } })),
      onSuccess: write,
    }),
    reorder: useMutation({
      mutationFn: (ids: number[]) => unwrap(api["cell-fields"].order.$put({ json: { ids } })),
      onSuccess: write,
    }),
  };
}

/** The day values a cell can show, in picker order; exercise labels follow. */
export const CELL_METRIC_NAMES: Record<Exclude<CellMetric, "exercise">, string> = {
  net: "Net calories",
  in: "Calories in",
  active: "Active calories",
  base: "Base calories",
  out: "Calories out (total)",
  weight: "Weight",
  steps: "Steps",
  distance: "Distance",
  exercises: "Exercises logged (all)",
};

/** "Net calories", "Walking · times logged", "Walking · miles". */
export function describeField(
  field: Pick<CellField, "metric" | "exerciseTypeId" | "unit">,
  labels: readonly ExerciseType[],
): string {
  if (field.metric !== "exercise") return CELL_METRIC_NAMES[field.metric];
  const name = labels.find((l) => l.id === field.exerciseTypeId)?.name ?? "Exercise";
  return `${name} · ${field.unit ?? "times logged"}`;
}

/** Short on phones and desktops (−1.2k), in full on tablets (−1,234). */
export function formatCellValue(
  metric: CellMetric,
  value: number,
): { compact: string; full: string } {
  switch (metric) {
    case "net":
      return {
        compact: formatCompact(value, { signed: true }),
        full: formatNumber(value, { signed: true }),
      };
    case "weight":
      return { compact: formatWeight(value), full: formatWeight(value) };
    case "distance":
    case "exercise":
      return {
        compact: value >= 1000 ? formatCompact(value) : formatAmount(value),
        full: formatAmount(value),
      };
    case "exercises":
      return { compact: String(value), full: String(value) };
    default:
      return { compact: formatCompact(value), full: formatNumber(value) };
  }
}

/** Background and text colour of a value's pill on a cell: its chosen colour, or its own. */
export function cellTone(
  field: Pick<CellField, "metric" | "exerciseTypeId" | "color">,
  value: number,
) {
  if (field.color) return paletteTone[field.color].pill;
  const card = (t: { card: string; text: string }) => `${t.card} ${t.text}`;
  switch (field.metric) {
    case "net":
      return netTone(value).pill;
    case "in":
      return card(metricTone.in);
    case "active":
    case "base":
    case "out":
      return card(metricTone.out);
    case "weight":
      return card(metricTone.weight);
    case "steps":
      return card(metricTone.steps);
    case "distance":
      return card(metricTone.distance);
    case "exercises":
      return card(metricTone.exercise);
    case "exercise":
      return labelTone(field.exerciseTypeId ?? 0).chip;
  }
}

/** A stable key for a field's pill: "net", "exercises", "exercise:7", "exercise:7:miles". */
export function fieldKey(field: Pick<CellField, "metric" | "exerciseTypeId" | "unit">): string {
  if (field.metric !== "exercise") return field.metric;
  return ["exercise", field.exerciseTypeId, field.unit].filter((p) => p !== null).join(":");
}
