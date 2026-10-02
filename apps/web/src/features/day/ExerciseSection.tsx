import { type DayDetail, EXERCISE_NOTE_MAX, type ExerciseEntry } from "@better-health/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { byRecentUse, exerciseTypesQuery } from "@/features/labels/queries";
import { ApiError } from "@/lib/api";
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
    <section aria-labelledby="exercise-heading" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 id="exercise-heading" className="text-sm font-semibold">
          Exercise
        </h3>
        {!addOpen && (
          <Button variant="outline" size="sm" onClick={() => onAddOpenChange(true)}>
            <Plus /> Add exercise
          </Button>
        )}
      </div>

      {day.exercises.length === 0 && !addOpen && (
        <p className="text-sm text-muted-foreground">No exercise logged.</p>
      )}

      <ul className="divide-y rounded-md border empty:hidden">
        {day.exercises.map((entry) =>
          editing === entry.id ? (
            <li key={entry.id} className="p-2">
              <ExerciseForm date={day.date} entry={entry} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={entry.id} className="flex items-center gap-2 p-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{entry.name}</span>
                {entry.archived && <span className="text-muted-foreground"> (archived)</span>}
                {entry.note && <span className="text-muted-foreground"> – {entry.note}</span>}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${entry.name}`}
                onClick={() => setEditing(entry.id)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${entry.name}${entry.note ? ` – ${entry.note}` : ""}`}
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

/** Adds a new entry, or edits `entry` when given. */
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
  const [note, setNote] = useState(entry?.note ?? "");
  const mutation = entry ? mutations.update : mutations.add;
  const error = errorText(mutation.error);

  const choices = byRecentUse(types.data ?? []);
  // An archived label stays selectable on the entry that already uses it.
  if (entry && !choices.some((t) => t.id === entry.exerciseTypeId)) {
    choices.unshift({
      id: entry.exerciseTypeId,
      name: entry.name,
      sortOrder: -1,
      archived: true,
      lastUsedOn: null,
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (typeId === null) return;
    const done = { onSuccess: onDone };
    if (entry) mutations.update.mutate({ id: entry.id, exerciseTypeId: typeId, note }, done);
    else mutations.add.mutate({ exerciseTypeId: typeId, note }, done);
  }

  if (types.isSuccess && choices.length === 0) {
    return (
      <div className="space-y-2 rounded-md border p-3 text-sm">
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
      aria-label={entry ? `Edit ${entry.name}` : "Add exercise"}
      className="space-y-3 rounded-md border p-3"
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Exercise</legend>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          {choices.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={typeId === t.id}
              onClick={() => setTypeId(t.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                typeId === t.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1">
        <label htmlFor={`${id}-note`} className="text-sm font-medium">
          Note
        </label>
        <Input
          id={`${id}-note`}
          value={note}
          maxLength={EXERCISE_NOTE_MAX}
          placeholder="e.g. 3 miles, 5 sets"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={typeId === null || mutation.isPending}>
          {entry ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}
