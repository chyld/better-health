import { caloriesSchema, type DayPatch, formatNumber, weightSchema } from "@better-health/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { longDate } from "@/features/calendar/describe";
import { ApiError } from "@/lib/api";
import { ExerciseSection } from "./ExerciseSection";
import { NoteField } from "./NoteField";
import { NumberField } from "./NumberField";
import { dayQuery, useUpdateDay } from "./queries";

/** `heading` is false inside the phone sheet, whose title already names the day. */
export function DayPanel({
  date,
  heading = true,
  addExerciseOpen,
  onAddExerciseOpenChange,
}: {
  date: string;
  heading?: boolean;
  addExerciseOpen?: boolean;
  onAddExerciseOpenChange?: (open: boolean) => void;
}) {
  const { data: day, isError, refetch } = useQuery(dayQuery(date));
  const update = useUpdateDay(date);
  const [localAddOpen, setLocalAddOpen] = useState(false);
  const addOpen = addExerciseOpen ?? localAddOpen;
  const setAddOpen = onAddExerciseOpenChange ?? setLocalAddOpen;
  const save = (patch: DayPatch) => update.mutate(patch);

  return (
    <section aria-label={`Details for ${longDate(date)}`} className="space-y-6 p-4 lg:space-y-5">
      {heading ? (
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{longDate(date)}</h2>
          <SaveStatus pending={update.isPending} error={update.error} saved={update.isSuccess} />
        </div>
      ) : (
        // In the phone sheet the title sits above; the status rides beside the close button.
        <div className="absolute top-5 right-14">
          <SaveStatus pending={update.isPending} error={update.error} saved={update.isSuccess} />
        </div>
      )}

      {isError && (
        <div role="alert" className="flex items-center gap-2 text-sm">
          Could not load this day.
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {day && (
        <>
          <div className="space-y-4 lg:space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <NumberField
                label="Calories in"
                value={day.caloriesIn}
                schema={caloriesSchema}
                onSave={(caloriesIn) => save({ caloriesIn })}
              />
              <NumberField
                label="Calories out"
                value={day.caloriesOut}
                schema={caloriesSchema}
                onSave={(caloriesOut) => save({ caloriesOut })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 lg:grid lg:grid-cols-[1fr_8rem] lg:gap-3 lg:bg-transparent lg:p-0 lg:text-sm">
              <span className="font-medium">Net</span>
              <output
                aria-label="Net"
                className="text-right text-2xl font-semibold tabular-nums lg:px-3 lg:text-sm"
              >
                {day.net === null ? "—" : formatNumber(day.net, { signed: true })}
              </output>
            </div>
            <NumberField
              label="Weight"
              value={day.weightLbs}
              schema={weightSchema}
              decimal
              suffix="lbs"
              onSave={(weightLbs) => save({ weightLbs })}
            />
          </div>

          <ExerciseSection day={day} addOpen={addOpen} onAddOpenChange={setAddOpen} />

          <NoteField value={day.note} onSave={(note) => save({ note })} />
        </>
      )}
    </section>
  );
}

function SaveStatus({
  pending,
  error,
  saved,
}: {
  pending: boolean;
  error: unknown;
  saved: boolean;
}) {
  if (pending) {
    return (
      <span role="status" className="text-xs text-muted-foreground">
        Saving…
      </span>
    );
  }
  if (error) {
    return (
      <span role="alert" className="text-xs text-destructive">
        {error instanceof ApiError ? `Not saved: ${error.message}` : "Not saved"}
      </span>
    );
  }
  return (
    <span role="status" className="text-xs text-muted-foreground">
      {saved ? "Saved" : ""}
    </span>
  );
}
