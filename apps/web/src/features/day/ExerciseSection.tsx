import {
  amountSchema,
  type DayDetail,
  EXERCISE_UNIT_MAX,
  type ExerciseEntry,
  entryText,
  exerciseUnitSchema,
  formatAmount,
  MEASUREMENTS_MAX,
  type Measurement,
  measurementText,
} from "@better-health/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Dumbbell, Plus, Ruler, Trash2, X } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { byRecentUse, exerciseTypesQuery, groupByCategory } from "@/features/labels/queries";
import { ApiError } from "@/lib/api";
import { labelTone, metricTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { useExerciseMutations } from "./queries";

type Mutations = ReturnType<typeof useExerciseMutations>;

const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : e ? "Something went wrong" : null;

/**
 * Tap a sticker to log that exercise; that's all it takes. Each logged entry can then be
 * measured, in any units, as many as the user likes (e.g. 3 miles and 30 minutes).
 * Each new `focusRequest` (the e shortcut) moves focus to the first sticker, as soon as the
 * stickers have loaded.
 */
export function ExerciseSection({ day, focusRequest }: { day: DayDetail; focusRequest?: number }) {
  const mutations = useExerciseMutations(day.date);
  const [measuring, setMeasuring] = useState<number | null>(null);
  const error = errorText(mutations.add.error ?? mutations.update.error ?? mutations.remove.error);

  return (
    <section
      aria-labelledby="exercise-heading"
      className={cn("space-y-3 rounded-2xl p-3 ring-1", metricTone.exercise.card)}
    >
      <h3
        id="exercise-heading"
        className={cn("flex items-center gap-2 text-sm font-semibold", metricTone.exercise.text)}
      >
        <span
          className={cn(
            "grid size-7 place-items-center rounded-lg [&_svg]:size-4",
            metricTone.exercise.icon,
          )}
        >
          <Dumbbell aria-hidden="true" />
        </span>
        Exercise
      </h3>

      <Stickers mutations={mutations} focusRequest={focusRequest} />

      {day.exercises.length === 0 ? (
        <p className="text-sm text-sky-900">No exercise logged.</p>
      ) : (
        <ul aria-label="Logged exercises" className="space-y-1.5">
          {day.exercises.map((entry) => (
            <EntryRow
              key={entry.id}
              mutations={mutations}
              entry={entry}
              measuring={measuring === entry.id}
              onMeasuringChange={(open) => setMeasuring(open ? entry.id : null)}
            />
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

/** One button per active label, most recently used first, grouped by category. */
function Stickers({
  mutations: { add },
  focusRequest,
}: {
  mutations: Mutations;
  focusRequest?: number;
}) {
  const types = useQuery(exerciseTypesQuery());
  const ref = useRef<HTMLDivElement>(null);
  const handledRequest = useRef<number | undefined>(undefined);
  const loaded = types.isSuccess;

  useEffect(() => {
    if (!loaded || focusRequest === undefined || focusRequest === handledRequest.current) return;
    handledRequest.current = focusRequest;
    ref.current?.querySelector("button")?.focus();
  }, [focusRequest, loaded]);

  if (types.isSuccess && types.data.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>No exercise labels yet.</span>
        <Button size="sm" asChild>
          <Link to="/labels">Create labels</Link>
        </Button>
      </div>
    );
  }

  const groups = groupByCategory(byRecentUse(types.data ?? []));
  // Headings only help once at least one label has a category.
  const showHeadings = groups.length > 1 || Boolean(groups[0]?.category);

  return (
    <div ref={ref} role="group" aria-label="Tap to log" className="space-y-2">
      {groups.map((group) => (
        <div key={group.category} className="flex flex-wrap gap-1.5">
          {showHeadings && (
            <span
              aria-hidden="true"
              className="w-full text-xs font-bold tracking-wide text-sky-900 uppercase"
            >
              {group.category || "No category"}
            </span>
          )}
          {group.types.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-label={`Log ${t.name}`}
              disabled={add.isPending}
              onClick={() => add.mutate({ exerciseTypeId: t.id })}
              className={cn(
                "inline-flex items-center gap-1 rounded-full py-2.5 pr-4 pl-3 text-base font-semibold ring-1 transition-all outline-none hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-95 disabled:opacity-60 lg:py-1.5 lg:pr-3 lg:pl-2 lg:text-sm",
                labelTone(t.id).chip,
              )}
            >
              <Plus aria-hidden="true" className="size-4" />
              {t.name}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function EntryRow({
  mutations: { update, remove },
  entry,
  measuring,
  onMeasuringChange,
}: {
  mutations: Mutations;
  entry: ExerciseEntry;
  measuring: boolean;
  onMeasuringChange: (open: boolean) => void;
}) {
  const busy = update.isPending || remove.isPending;
  const save = (measurements: Measurement[], onSuccess?: () => void) =>
    update.mutate({ id: entry.id, measurements }, { onSuccess });

  return (
    <li className="space-y-2 rounded-xl bg-white py-1 pr-1 pl-3 text-base shadow-xs lg:text-sm">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn("size-2.5 shrink-0 rounded-full", labelTone(entry.exerciseTypeId).dot)}
        />
        <span className="min-w-0 flex-1">
          <span className="font-medium">{entry.name}</span>
          {entry.category && (
            <span className="mx-1.5 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">
              {entry.category}
            </span>
          )}
          {entry.archived && <span className="text-muted-foreground"> (archived)</span>}
        </span>
        {!measuring && entry.measurements.length < MEASUREMENTS_MAX && (
          <Button
            variant="ghost"
            size="sm"
            className="h-11 text-sky-900 lg:h-8"
            aria-label={`Measure ${entry.name}`}
            onClick={() => onMeasuringChange(true)}
          >
            <Ruler /> Measure
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-11 lg:size-9"
          aria-label={`Delete ${entryText(entry)}`}
          disabled={busy}
          onClick={() => remove.mutate(entry.id)}
        >
          <Trash2 />
        </Button>
      </div>

      {entry.measurements.length > 0 && (
        <ul aria-label={`${entry.name} measurements`} className="flex flex-wrap gap-1.5 pb-1">
          {entry.measurements.map((m) => (
            <li
              key={m.unit}
              className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 py-0.5 pr-0.5 pl-2.5 text-sm text-sky-950"
            >
              <span className="font-bold tabular-nums">{formatAmount(m.amount)}</span>
              <span className="ml-1">{m.unit}</span>
              <button
                type="button"
                aria-label={`Remove ${measurementText(m)} from ${entry.name}`}
                disabled={busy}
                onClick={() => save(entry.measurements.filter((x) => x.unit !== m.unit))}
                className="grid size-8 place-items-center rounded-full outline-none hover:bg-sky-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:size-6"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {measuring && (
        <MeasureForm
          entry={entry}
          pending={update.isPending}
          onCancel={() => onMeasuringChange(false)}
          onSave={(m) =>
            // A unit already measured is replaced rather than added twice.
            save([...entry.measurements.filter((x) => x.unit !== m.unit), m], () =>
              onMeasuringChange(false),
            )
          }
        />
      )}
    </li>
  );
}

/** An amount and a unit; units already used with this label are one tap away. */
function MeasureForm({
  entry,
  pending,
  onSave,
  onCancel,
}: {
  entry: ExerciseEntry;
  pending: boolean;
  onSave: (measurement: Measurement) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const types = useQuery(exerciseTypesQuery(true));
  const measured = new Set(entry.measurements.map((m) => m.unit));
  const suggestions = (types.data?.find((t) => t.id === entry.exerciseTypeId)?.units ?? []).filter(
    (u) => !measured.has(u),
  );
  const [amountText, setAmountText] = useState("");
  // Until the user picks or types one, the unit last used with this label.
  const [typedUnit, setTypedUnit] = useState<string | null>(null);
  const unitText = typedUnit ?? suggestions[0] ?? "";

  const trimmed = amountText.trim();
  const parsed = /^\d+(\.\d+)?$/.test(trimmed) ? amountSchema.safeParse(Number(trimmed)) : null;
  const amountError =
    trimmed === ""
      ? null
      : !parsed
        ? "Enter a number"
        : parsed.success
          ? null
          : (parsed.error.issues[0]?.message ?? "Invalid");
  const unit = exerciseUnitSchema.safeParse(unitText);
  const ready = parsed?.success && unit.success;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!parsed?.success || !unit.success) return;
    onSave({ amount: parsed.data, unit: unit.data });
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
      aria-label={`Measure ${entry.name}`}
      className="space-y-2 pr-2 pb-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor={`${id}-amount`} className="text-xs font-medium">
            Amount
          </label>
          <Input
            id={`${id}-amount`}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            autoFocus
            value={amountText}
            placeholder="e.g. 3"
            aria-invalid={amountError ? true : undefined}
            aria-describedby={amountError ? `${id}-amount-error` : undefined}
            onChange={(e) => setAmountText(e.target.value)}
            className="h-12 text-xl tabular-nums md:text-xl lg:h-9 lg:text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-unit`} className="text-xs font-medium">
            Unit
          </label>
          <Input
            id={`${id}-unit`}
            autoComplete="off"
            autoCapitalize="none"
            enterKeyHint="done"
            maxLength={EXERCISE_UNIT_MAX}
            value={unitText}
            placeholder="e.g. miles"
            onChange={(e) => setTypedUnit(e.target.value)}
            className="h-12 text-xl md:text-xl lg:h-9 lg:text-sm"
          />
        </div>
      </div>
      {amountError && (
        <p id={`${id}-amount-error`} className="text-xs text-destructive">
          {amountError}
        </p>
      )}
      {suggestions.length > 0 && (
        <div role="group" aria-label="Units used before" className="flex flex-wrap gap-1.5">
          {suggestions.map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unitText.trim().toLowerCase() === u}
              onClick={() => setTypedUnit(u)}
              className="rounded-full bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-900 ring-1 ring-sky-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-sky-700 aria-pressed:text-white aria-pressed:ring-transparent lg:py-1"
            >
              {u}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 lg:flex lg:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-12 text-base lg:h-8 lg:text-sm"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-12 text-base lg:h-8 lg:text-sm"
          disabled={!ready || pending}
        >
          Save
        </Button>
      </div>
    </form>
  );
}
