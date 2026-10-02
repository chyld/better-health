import { type MonthResponse, shiftMonth } from "@better-health/shared";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api, unwrap } from "@/lib/api";

export const monthQuery = (month: string) =>
  queryOptions({
    queryKey: ["month", month],
    queryFn: (): Promise<MonthResponse> => unwrap(api.months[":month"].$get({ param: { month } })),
    staleTime: 30_000,
  });

/** Loads a month and quietly prefetches its neighbours so navigation is instant. */
export function useMonth(month: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    for (const delta of [-1, 1]) {
      void queryClient.prefetchQuery(monthQuery(shiftMonth(month, delta)));
    }
  }, [month, queryClient]);
  return useQuery(monthQuery(month));
}
