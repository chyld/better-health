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
import { Flame, Footprints, Lock, Route, Scale, Sparkles, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { longDate } from "@/features/calendar/describe";
import { ApiError } from "@/lib/api";
import { metricTone, netTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { ExerciseSection } from "./ExerciseSection";
import { NoteField } from "./NoteField";
import { NumberField } from "./NumberField";
import { dayQuery, useUpdateDay } from "./queries";

/**
 * `heading` is false inside the phone sheet, whose title already names the day. A `locked` day
 * (older than two days, or in the future) is shown read only.
 */
export function DayPanel({
  date,
  heading = true,
  locked = false,
  focusExercise,
}: {
  date: string;
  heading?: boolean;
  locked?: boolean;
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

      {locked && (
        <p className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
          <Lock aria-hidden="true" className="size-4 shrink-0" />
          Only today and the 2 days before it can be changed.
        </p>
      )}

      {day && (
        <>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <NumberField
                readOnly={locked}
                label="Calories in"
                icon={<Utensils />}
                tone={metricTone.in}
                value={day.caloriesIn}
                schema={caloriesSchema}
                onSave={(caloriesIn) => save({ caloriesIn })}
              />
              <NumberField
                readOnly={locked}
                label="Active calories"
                icon={<Flame />}
                tone={metricTone.out}
                value={day.caloriesActive}
                schema={caloriesSchema}
                hint={baseHint(day.caloriesBase, day.caloriesOut)}
                onSave={(caloriesActive) => save({ caloriesActive })}
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
              readOnly={locked}
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
                readOnly={locked}
                label="Steps"
                icon={<Footprints />}
                tone={metricTone.steps}
                value={day.steps}
                schema={stepsSchema}
                onSave={(steps) => save({ steps })}
              />
              <NumberField
                readOnly={locked}
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

          <ExerciseSection day={day} focusRequest={focusExercise} locked={locked} />

          <NoteField value={day.note} readOnly={locked} onSave={(note) => save({ note })} />
        </>
      )}
    </section>
  );
}

/** "+ 2,000 base = 3,000 out": how the day's burn adds up, once there is a base. */
function baseHint(base: number, out: number | null) {
  if (base === 0) return undefined;
  const plus = `+ ${formatNumber(base)} base`;
  return out === null ? plus : `${plus} = ${formatNumber(out)} out`;
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
