import {
  type DaySummary,
  type ExerciseType,
  formatAmount,
  formatNumber,
  formatWeight,
  type HighlightMetric,
  type HighlightOperator,
  type HighlightRule,
  type HighlightRuleCreate,
  matchHighlight,
} from "@better-health/shared";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { exerciseTypesQuery } from "@/features/labels/queries";
import { api, unwrap } from "@/lib/api";

export const highlightsQuery = queryOptions({
  queryKey: ["highlights"],
  queryFn: (): Promise<HighlightRule[]> => unwrap(api.highlights.$get()),
});

export function useHighlightMutations() {
  const queryClient = useQueryClient();
  const write = (rules: HighlightRule[]) =>
    queryClient.setQueryData(highlightsQuery.queryKey, rules);
  return {
    create: useMutation({
      mutationFn: (json: HighlightRuleCreate) => unwrap(api.highlights.$post({ json })),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: highlightsQuery.queryKey }),
    }),
    remove: useMutation({
      mutationFn: (id: number) =>
        unwrap(api.highlights[":id"].$delete({ param: { id: String(id) } })),
      onSuccess: write,
    }),
    reorder: useMutation({
      mutationFn: (ids: number[]) => unwrap(api.highlights.order.$put({ json: { ids } })),
      onSuccess: write,
    }),
  };
}

export const METRIC_NAMES: Record<Exclude<HighlightMetric, "exercise">, string> = {
  in: "Calories in",
  out: "Calories out",
  net: "Net calories",
  weight: "Weight",
  steps: "Steps",
  distance: "Distance",
};

export const OPERATOR_TEXT: Record<HighlightOperator, string> = {
  "<": "<",
  "<=": "≤",
  "=": "=",
  ">=": "≥",
  ">": ">",
};

/**
 * "Weight < 200 lbs", "Net calories ≤ −500 cal", "Steps ≥ 10,000", "Distance ≥ 3 mi",
 * "Walking ≥ 3 miles", "Yoga ≥ 2 times".
 */
export function describeRule(rule: HighlightRule, labels: readonly ExerciseType[]): string {
  const op = OPERATOR_TEXT[rule.operator];
  switch (rule.metric) {
    case "exercise": {
      const label = labels.find((l) => l.id === rule.exerciseTypeId);
      const name = label?.name ?? "Exercise";
      const unit = rule.unit ?? (rule.target === 1 ? "time" : "times");
      return `${name} ${op} ${formatAmount(rule.target)} ${unit}`;
    }
    case "weight":
      return `Weight ${op} ${formatWeight(rule.target)} lbs`;
    case "steps":
      return `Steps ${op} ${formatNumber(rule.target)}`;
    case "distance":
      return `Distance ${op} ${formatAmount(rule.target)} mi`;
    case "net":
      return `Net calories ${op} ${formatNumber(rule.target, { signed: true })} cal`;
    default:
      return `${METRIC_NAMES[rule.metric]} ${op} ${formatNumber(rule.target)} cal`;
  }
}

/** For the calendar: which rule, if any, colours a day, and how to say so. */
export function useHighlighter() {
  const rules = useQuery(highlightsQuery).data ?? [];
  // Label names are only needed to describe exercise rules.
  const labels =
    useQuery({
      ...exerciseTypesQuery(true),
      enabled: rules.some((r) => r.metric === "exercise"),
    }).data ?? [];
  return (day: DaySummary) => {
    const rule = matchHighlight(day, rules);
    return rule && { color: rule.color, text: describeRule(rule, labels) };
  };
}
