import type { BaseCaloriesChange, BaseCaloriesSet } from "@better-health/shared";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";

/** The user's base burn changes, newest first. */
export const baseCaloriesQuery = queryOptions({
  queryKey: ["base-calories"],
  queryFn: (): Promise<BaseCaloriesChange[]> => unwrap(api["base-calories"].$get()),
});

export function useSetBaseCalories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: BaseCaloriesSet) => unwrap(api["base-calories"].$put({ json })),
    onSuccess: (changes) => {
      queryClient.setQueryData(baseCaloriesQuery.queryKey, changes);
      // Every day's total burn and net from the start date on may have changed.
      for (const queryKey of [["month"], ["day"], ["log"], ["history"]]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
