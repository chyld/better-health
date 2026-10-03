import {
  amountSchema,
  type DayDetail,
  type ExerciseEntry,
  entryText,
  formatAmount,
  labelText,
} from "@better-health/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Dumbbell, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { byRecentUse, exerciseTypesQuery, groupByCategory } from "@/features/labels/queries";
import { ApiError } from "@/lib/api";
import { labelTone, metricTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { useExerciseMutations } from "./queries";

const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : e ? "Something went wrong" : null;

export function ExerciseSection({
  day,
  addOpen,
  onAddOpenChange,
}: {
  day: DayDetail;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}) {
  const mutations = useExerciseMutations(day.date);
  const [editing, setEditing] = useState<number | null>(null);
  const error = errorText(mutations.remove.error);

  return (
    <section
      aria-labelledby="exercise-heading"
      className={cn("space-y-3 rounded-2xl p-3 ring-1", metricTone.exercise.card)}
    >
      <div className="flex items-center justify-between">
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
        {!addOpen && (
          <Button
            variant="outline"
            size="sm"
            className="h-11 px-4 text-base lg:h-8 lg:px-3 lg:text-sm"
            onClick={() => onAddOpenChange(true)}
          >
            <Plus /> Add exercise
          </Button>
        )}
      </div>

      {day.exercises.length === 0 && !addOpen && (
        <p className="text-sm text-sky-900">No exercise logged.</p>
      )}

      <ul className="space-y-1.5 empty:hidden">
        {day.exercises.map((entry) =>
          editing === entry.id ? (
            <li key={entry.id} className="rounded-xl bg-white p-2 shadow-xs">
              <ExerciseForm date={day.date} entry={entry} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li
              key={entry.id}
              className="flex items-center gap-2 rounded-xl bg-white py-1 pr-1 pl-3 text-base shadow-xs lg:text-sm"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  labelTone(entry.exerciseTypeId).dot,
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{entry.name}</span>
                {entry.category && (
                  <span className="mx-1.5 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">
                    {entry.category}
                  </span>
                )}
                {entry.archived && <span className="text-muted-foreground"> (archived)</span>}
                <span className="text-muted-foreground">
                  {" – "}
                  <span className="font-bold text-foreground tabular-nums">
                    {formatAmount(entry.amount)}
                  </span>
                  {entry.unit && ` ${entry.unit}`}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 lg:size-9"
                aria-label={`Edit ${entryText(entry)}`}
                onClick={() => setEditing(entry.id)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 lg:size-9"
                aria-label={`Delete ${entryText(entry)}`}
                disabled={mutations.remove.isPending}
                onClick={() => mutations.remove.mutate(entry.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ),
        )}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {addOpen && <ExerciseForm date={day.date} onDone={() => onAddOpenChange(false)} />}
    </section>
  );
}

/** Adds a new entry, or edits `entry` when given: pick a label, enter an amount. */
function ExerciseForm({
  date,
  entry,
  onDone,
}: {
  date: string;
  entry?: ExerciseEntry;
  onDone: () => void;
}) {
  const id = useId();
  const types = useQuery(exerciseTypesQuery());
  const mutations = useExerciseMutations(date);
  const [typeId, setTypeId] = useState<number | null>(entry?.exerciseTypeId ?? null);
  const [amountText, setAmountText] = useState(entry ? String(entry.amount) : "");
  const mutation = entry ? mutations.update : mutations.add;
  const serverError = errorText(mutation.error);
  const amountRef = useRef<HTMLInputElement>(null);

  function pick(id: number) {
    setTypeId(id);
    // Straight to the amount: on a phone this opens the number pad.
    const input = amountRef.current;
    input?.focus();
    input?.closest("form")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }

  const choices = byRecentUse(types.data ?? []);
  // An archived label stays selectable on the entry that already uses it.
  if (entry && !choices.some((t) => t.id === entry.exerciseTypeId)) {
    choices.unshift({
      id: entry.exerciseTypeId,
      name: entry.name,
      category: entry.category,
      unit: entry.unit,
      sortOrder: -1,
      archived: true,
      lastUsedOn: null,
    });
  }
  const selected = choices.find((t) => t.id === typeId);
  const groups = groupByCategory(choices);
  // Headings only help once at least one label has a category.
  const showHeadings = groups.some((g) => g.category);

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
  const amount = parsed?.success ? parsed.data : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (typeId === null || amount === null) return;
    const done = { onSuccess: onDone };
    if (entry) mutations.update.mutate({ id: entry.id, exerciseTypeId: typeId, amount }, done);
    else mutations.add.mutate({ exerciseTypeId: typeId, amount }, done);
  }

  if (types.isSuccess && choices.length === 0) {
    return (
      <div className="space-y-2 rounded-xl bg-white p-3 text-sm shadow-xs">
        <p>No exercise labels yet.</p>
        <div className="flex gap-2">
          <Button size="sm" asChild>
            <Link to="/labels">Create labels</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onDone();
        }
      }}
      aria-label={entry ? `Edit ${entryText(entry)}` : "Add exercise"}
      className="space-y-3 rounded-xl bg-white p-3 shadow-xs"
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Pick an exercise</legend>
        <div role="radiogroup" className="space-y-2.5">
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
                  role="radio"
                  aria-checked={typeId === t.id}
                  onClick={() => pick(t.id)}
                  className={cn(
                    "rounded-full px-4 py-2.5 text-base font-semibold ring-1 transition-all lg:px-3 lg:py-1.5 lg:text-sm",
                    typeId === t.id
                      ? `${labelTone(t.id).on} text-white shadow-md ring-transparent motion-safe:scale-105`
                      : `${labelTone(t.id).chip} hover:brightness-95`,
                  )}
                >
                  {labelText(t)}
                </button>
              ))}
            </div>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1">
        <label htmlFor={`${id}-amount`} className="text-sm font-medium">
          Amount
        </label>
        <div className="relative">
          <Input
            ref={amountRef}
            id={`${id}-amount`}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            value={amountText}
            placeholder="e.g. 3"
            aria-invalid={amountError ? true : undefined}
            aria-describedby={amountError ? `${id}-amount-error` : undefined}
            onChange={(e) => setAmountText(e.target.value)}
            className="h-14 pr-28 text-2xl tabular-nums md:text-2xl lg:h-9 lg:pr-24 lg:text-sm"
          />
          {selected?.unit && (
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base text-muted-foreground lg:right-3 lg:text-sm">
              {selected.unit}
            </span>
          )}
        </div>
        {amountError && (
          <p id={`${id}-amount-error`} className="text-xs text-destructive">
            {amountError}
          </p>
        )}
      </div>
      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 lg:flex lg:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-12 text-base lg:h-8 lg:text-sm"
          onClick={onDone}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-12 text-base lg:h-8 lg:text-sm"
          disabled={typeId === null || amount === null || mutation.isPending}
        >
          {entry ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}
