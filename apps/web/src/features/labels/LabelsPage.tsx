import {
  EXERCISE_NAME_MAX,
  EXERCISE_UNIT_MAX,
  type ExerciseType,
  labelText,
} from "@better-health/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, ArrowDown, ArrowLeft, ArrowUp, Pencil } from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { exerciseTypesQuery, useLabelMutations } from "./queries";

const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : e ? "Something went wrong" : null;

export function LabelsPage() {
  const { data, isPending, isError, refetch } = useQuery(exerciseTypesQuery(true));
  const mutations = useLabelMutations();
  const active = data?.filter((t) => !t.archived) ?? [];
  const archived = data?.filter((t) => t.archived) ?? [];
  const error = errorText(mutations.update.error ?? mutations.reorder.error);

  function move(index: number, delta: -1 | 1) {
    const ids = active.map((t) => t.id);
    const target = index + delta;
    const [moved] = ids.splice(index, 1);
    if (moved === undefined || target < 0 || target > ids.length) return;
    ids.splice(target, 0, moved);
    mutations.reorder.mutate(ids);
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/" aria-label="Back to calendar">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Exercise labels</h1>
      </div>

      <AddLabelForm />

      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && (
        <div role="alert" className="flex items-center gap-2 text-sm">
          Could not load labels.
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {data && (
        <section aria-labelledby="active-heading" className="space-y-2">
          <h2 id="active-heading" className="text-sm font-semibold">
            Active
          </h2>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No labels yet. Add one above.</p>
          ) : (
            <ul aria-labelledby="active-heading" className="divide-y rounded-md border">
              {active.map((t, i) => (
                <LabelRow key={t.id} label={t}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${labelText(t)} up`}
                    disabled={i === 0 || mutations.reorder.isPending}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${labelText(t)} down`}
                    disabled={i === active.length - 1 || mutations.reorder.isPending}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Archive ${labelText(t)}`}
                    onClick={() => mutations.update.mutate({ id: t.id, archived: true })}
                  >
                    <Archive />
                  </Button>
                </LabelRow>
              ))}
            </ul>
          )}
        </section>
      )}

      {archived.length > 0 && (
        <section aria-labelledby="archived-heading" className="space-y-2">
          <h2 id="archived-heading" className="text-sm font-semibold">
            Archived
          </h2>
          <p className="text-xs text-muted-foreground">
            Hidden from the picker; past entries still show them.
          </p>
          <ul aria-labelledby="archived-heading" className="divide-y rounded-md border">
            {archived.map((t) => (
              <LabelRow key={t.id} label={t}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Unarchive ${labelText(t)}`}
                  onClick={() => mutations.update.mutate({ id: t.id, archived: false })}
                >
                  <ArchiveRestore />
                </Button>
              </LabelRow>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/** Name and unit inputs side by side, shared by the add and edit forms. */
function NameUnitFields({
  name,
  unit,
  onName,
  onUnit,
  autoFocus,
}: {
  name: string;
  unit: string;
  onName: (v: string) => void;
  onUnit: (v: string) => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid flex-1 grid-cols-[3fr_2fr] gap-2">
      <div className="space-y-1">
        <Label htmlFor={`${id}-name`} className="text-xs">
          Exercise
        </Label>
        <Input
          id={`${id}-name`}
          placeholder="e.g. Walking"
          value={name}
          maxLength={EXERCISE_NAME_MAX}
          autoFocus={autoFocus}
          onChange={(e) => onName(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-unit`} className="text-xs">
          Unit
        </Label>
        <Input
          id={`${id}-unit`}
          placeholder="e.g. miles"
          value={unit}
          maxLength={EXERCISE_UNIT_MAX}
          onChange={(e) => onUnit(e.target.value)}
        />
      </div>
    </div>
  );
}

function AddLabelForm() {
  const { create } = useLabelMutations();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const ready = name.trim() !== "" && unit.trim() !== "";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    create.mutate(
      { name: name.trim(), unit: unit.trim() },
      {
        onSuccess: () => {
          setName("");
          setUnit("");
        },
      },
    );
  }

  return (
    <form onSubmit={submit} aria-label="Add label" className="space-y-1">
      <div className="flex items-end gap-2">
        <NameUnitFields
          name={name}
          unit={unit}
          onName={(v) => {
            setName(v);
            create.reset();
          }}
          onUnit={(v) => {
            setUnit(v);
            create.reset();
          }}
        />
        <Button type="submit" disabled={!ready || create.isPending}>
          Add
        </Button>
      </div>
      {create.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(create.error)}
        </p>
      )}
    </form>
  );
}

function LabelRow({ label, children }: { label: ExerciseType; children: ReactNode }) {
  const { update } = useLabelMutations();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);
  const [unit, setUnit] = useState(label.unit);

  function cancel() {
    setEditing(false);
    setName(label.name);
    setUnit(label.unit);
    update.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = { name: name.trim(), unit: unit.trim() };
    if (!next.name || !next.unit) return;
    if (next.name === label.name && next.unit === label.unit) return cancel();
    update.mutate({ id: label.id, ...next }, { onSuccess: () => setEditing(false) });
  }

  if (editing) {
    return (
      <li className="space-y-1 p-2">
        <form
          onSubmit={submit}
          onKeyDown={(e) => e.key === "Escape" && cancel()}
          aria-label={`Edit ${labelText(label)}`}
          className="flex items-end gap-2"
        >
          <NameUnitFields name={name} unit={unit} onName={setName} onUnit={setUnit} autoFocus />
          <Button
            type="submit"
            size="sm"
            disabled={!name.trim() || !unit.trim() || update.isPending}
          >
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        </form>
        {update.error && (
          <p role="alert" className="text-sm text-destructive">
            {errorText(update.error)}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-1 p-2 pl-3 text-sm">
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{label.name}</span>
        {label.unit ? (
          <span className="text-muted-foreground"> · {label.unit}</span>
        ) : (
          <span className="text-destructive"> · no unit, edit to add one</span>
        )}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit ${labelText(label)}`}
        onClick={() => setEditing(true)}
      >
        <Pencil />
      </Button>
      {children}
    </li>
  );
}
