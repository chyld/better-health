import type { ExerciseType } from "@better-health/shared";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";

export const exerciseTypesQuery = (includeArchived = false) =>
  queryOptions({
    queryKey: ["exercise-types", includeArchived ? "all" : "active"],
    queryFn: (): Promise<ExerciseType[]> =>
      unwrap(api["exercise-types"].$get({ query: includeArchived ? { include: "archived" } : {} })),
  });

/** Picker order: most recently used first, then never-used labels in list order. */
export function byRecentUse(types: ExerciseType[]): ExerciseType[] {
  return [...types].sort((a, b) => {
    if (a.lastUsedOn && b.lastUsedOn) return b.lastUsedOn.localeCompare(a.lastUsedOn);
    if (a.lastUsedOn) return -1;
    if (b.lastUsedOn) return 1;
    return a.sortOrder - b.sortOrder;
  });
}

export function useLabelMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ["exercise-types"] });
  // Renames and archive state show on day entries too.
  const onSuccessWithDays = async () => {
    await onSuccess();
    await queryClient.invalidateQueries({ queryKey: ["day"] });
  };
  return {
    create: useMutation({
      mutationFn: (json: { name: string; category: string; unit: string }) =>
        unwrap(api["exercise-types"].$post({ json })),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        ...json
      }: {
        id: number;
        name?: string;
        category?: string;
        unit?: string;
        archived?: boolean;
      }) => unwrap(api["exercise-types"][":id"].$patch({ param: { id: String(id) }, json })),
      onSuccess: onSuccessWithDays,
    }),
    reorder: useMutation({
      mutationFn: (ids: number[]) => unwrap(api["exercise-types"].order.$put({ json: { ids } })),
      onSuccess,
    }),
  };
}

/** Distinct categories already in use, for suggestions; first spelling wins, sorted. */
export function categoriesOf(types: ExerciseType[]): string[] {
  const seen = new Map<string, string>();
  for (const t of types) {
    const key = t.category.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, t.category.trim());
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Labels grouped by category for the picker. Groups follow the order of their first label
 * (so recency order carries over); labels without a category come last, under "".
 */
export function groupByCategory(
  types: ExerciseType[],
): { category: string; types: ExerciseType[] }[] {
  const groups = new Map<string, { category: string; types: ExerciseType[] }>();
  for (const t of types) {
    const key = t.category.trim().toLowerCase();
    const group = groups.get(key) ?? { category: t.category.trim(), types: [] };
    group.types.push(t);
    groups.set(key, group);
  }
  const all = [...groups.values()];
  return [...all.filter((g) => g.category), ...all.filter((g) => !g.category)];
}
