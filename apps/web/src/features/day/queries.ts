import type {
  DayDetail,
  DayPatch,
  DaySummary,
  ExerciseEntryCreate,
  ExerciseEntryPatch,
  MonthResponse,
} from "@better-health/shared";
import { netCalories } from "@better-health/shared";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";

export const dayQuery = (date: string) =>
  queryOptions({
    queryKey: ["day", date],
    queryFn: (): Promise<DayDetail> => unwrap(api.days[":date"].$get({ param: { date } })),
  });

function summarize(day: DayDetail): DaySummary {
  return {
    date: day.date,
    caloriesIn: day.caloriesIn,
    caloriesOut: day.caloriesOut,
    net: day.net,
    weightLbs: day.weightLbs,
    exerciseCount: day.exercises.length,
    hasNote: Boolean(day.note?.trim()),
  };
}

/** Writes a day into the day cache and into its month's cell. */
function useWriteDay() {
  const queryClient = useQueryClient();
  return (day: DayDetail) => {
    queryClient.setQueryData(dayQuery(day.date).queryKey, day);
    queryClient.setQueryData<MonthResponse>(
      ["month", day.date.slice(0, 7)],
      (month) =>
        month && {
          ...month,
          days: month.days.map((d) => (d.date === day.date ? summarize(day) : d)),
        },
    );
  };
}

export function useUpdateDay(date: string) {
  const queryClient = useQueryClient();
  const writeDay = useWriteDay();
  return useMutation({
    mutationKey: ["save", date],
    mutationFn: (patch: DayPatch) =>
      unwrap(api.days[":date"].$patch({ param: { date }, json: patch })),
    // Optimistic: the calendar cell updates before the server answers.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: dayQuery(date).queryKey });
      const previous = queryClient.getQueryData(dayQuery(date).queryKey);
      if (previous) {
        const next = { ...previous, ...patch } as DayDetail;
        next.net = netCalories(next.caloriesIn, next.caloriesOut);
        writeDay(next);
      }
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) writeDay(context.previous);
    },
    onSuccess: (day, patch) => {
      writeDay(day);
      if (patch.note !== undefined) void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export function useExerciseMutations(date: string) {
  const queryClient = useQueryClient();
  const writeDay = useWriteDay();
  const onSuccess = (day: DayDetail) => {
    writeDay(day);
    void queryClient.invalidateQueries({ queryKey: ["exercise-types"] });
  };
  return {
    add: useMutation({
      mutationKey: ["save", date],
      mutationFn: (json: ExerciseEntryCreate) =>
        unwrap(api.days[":date"].exercises.$post({ param: { date }, json })),
      onSuccess,
    }),
    update: useMutation({
      mutationKey: ["save", date],
      mutationFn: ({ id, ...json }: ExerciseEntryPatch & { id: number }) =>
        unwrap(
          api.days[":date"].exercises[":id"].$patch({ param: { date, id: String(id) }, json }),
        ),
      onSuccess,
    }),
    remove: useMutation({
      mutationKey: ["save", date],
      mutationFn: (id: number) =>
        unwrap(api.days[":date"].exercises[":id"].$delete({ param: { date, id: String(id) } })),
      onSuccess,
    }),
  };
}
