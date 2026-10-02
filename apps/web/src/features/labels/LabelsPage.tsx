import { EXERCISE_NAME_MAX, type ExerciseType } from "@better-health/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, ArrowDown, ArrowLeft, ArrowUp, Pencil } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
                    aria-label={`Move ${t.name} up`}
                    disabled={i === 0 || mutations.reorder.isPending}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${t.name} down`}
                    disabled={i === active.length - 1 || mutations.reorder.isPending}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Archive ${t.name}`}
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
                  aria-label={`Unarchive ${t.name}`}
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

function AddLabelForm() {
  const { create } = useLabelMutations();
  const [name, setName] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate(name.trim(), { onSuccess: () => setName("") });
  }

  return (
    <form onSubmit={submit} aria-label="Add label" className="space-y-1">
      <div className="flex gap-2">
        <Input
          aria-label="New label"
          placeholder="e.g. Walking"
          value={name}
          maxLength={EXERCISE_NAME_MAX}
          onChange={(e) => {
            setName(e.target.value);
            create.reset();
          }}
        />
        <Button type="submit" disabled={!name.trim() || create.isPending}>
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

function LabelRow({ label, children }: { label: ExerciseType; children: React.ReactNode }) {
  const { update } = useLabelMutations();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === label.name) {
      setEditing(false);
      setName(label.name);
      return;
    }
    update.mutate({ id: label.id, name: trimmed }, { onSuccess: () => setEditing(false) });
  }

  if (editing) {
    return (
      <li className="space-y-1 p-2">
        <form onSubmit={submit} aria-label={`Rename ${label.name}`} className="flex gap-2">
          <Input
            aria-label="Label name"
            value={name}
            maxLength={EXERCISE_NAME_MAX}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditing(false);
                setName(label.name);
              }
            }}
          />
          <Button type="submit" size="sm" disabled={update.isPending}>
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setName(label.name);
            }}
          >
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
      <span className="min-w-0 flex-1 truncate">{label.name}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Rename ${label.name}`}
        onClick={() => setEditing(true)}
      >
        <Pencil />
      </Button>
      {children}
    </li>
  );
}
