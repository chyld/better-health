import {
  caloriesSchema,
  type DayPatch,
  distanceSchema,
  formatNumber,
  formatWeight,
  stepsSchema,
  weightSchema,
} from "@better-health/shared";
import { useQuery } from "@tanstack/react-query";
import { Flame, Footprints, Route, Scale, Sparkles, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { longDate } from "@/features/calendar/describe";
import { ApiError } from "@/lib/api";
import { metricTone, netTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { ExerciseSection } from "./ExerciseSection";
import { NoteField } from "./NoteField";
import { NumberField } from "./NumberField";
import { dayQuery, useUpdateDay } from "./queries";

/** `heading` is false inside the phone sheet, whose title already names the day. */
export function DayPanel({
  date,
  heading = true,
  focusExercise,
}: {
  date: string;
  heading?: boolean;
  /** Each new value focuses the exercise stickers, once they have loaded. */
  focusExercise?: number;
}) {
  const { data: day, isError, refetch } = useQuery(dayQuery(date));
  const update = useUpdateDay(date);
  const save = (patch: DayPatch) => update.mutate(patch);

  return (
    <section aria-label={`Details for ${longDate(date)}`} className="space-y-6 p-4 lg:space-y-5">
      {heading ? (
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-extrabold tracking-tight">{longDate(date)}</h2>
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
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <NumberField
                label="Calories in"
                icon={<Utensils />}
                tone={metricTone.in}
                value={day.caloriesIn}
                schema={caloriesSchema}
                onSave={(caloriesIn) => save({ caloriesIn })}
              />
              <NumberField
                label="Calories out"
                icon={<Flame />}
                tone={metricTone.out}
                value={day.caloriesOut}
                schema={caloriesSchema}
                onSave={(caloriesOut) => save({ caloriesOut })}
              />
            </div>
            <div
              className={cn(
                "flex items-center justify-between rounded-2xl px-4 py-3 ring-1 ring-transparent",
                netTone(day.net).card,
              )}
            >
              <span className={cn("flex items-center gap-2 font-semibold", netTone(day.net).text)}>
                <span className="grid size-7 place-items-center rounded-lg bg-white/80 [&_svg]:size-4">
                  <Sparkles aria-hidden="true" />
                </span>
                Net
              </span>
              <output
                aria-label="Net"
                className={cn(
                  "text-right text-3xl font-extrabold tracking-tight tabular-nums lg:text-2xl",
                  netTone(day.net).text,
                )}
              >
                {day.net === null ? "—" : formatNumber(day.net, { signed: true })}
              </output>
            </div>
            <NumberField
              label="Weight"
              icon={<Scale />}
              tone={metricTone.weight}
              value={day.weightLbs}
              schema={weightSchema}
              decimal
              format={formatWeight}
              suffix="lbs"
              onSave={(weightLbs) => save({ weightLbs })}
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <NumberField
                label="Steps"
                icon={<Footprints />}
                tone={metricTone.steps}
                value={day.steps}
                schema={stepsSchema}
                onSave={(steps) => save({ steps })}
              />
              <NumberField
                label="Distance"
                icon={<Route />}
                tone={metricTone.distance}
                value={day.distanceMiles}
                schema={distanceSchema}
                decimal
                suffix="mi"
                onSave={(distanceMiles) => save({ distanceMiles })}
              />
            </div>
          </div>

          <ExerciseSection day={day} focusRequest={focusExercise} />

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
