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
      mutationFn: (json: { name: string; unit: string }) =>
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
