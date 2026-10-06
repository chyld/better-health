import { EXERCISE_CATEGORY_MAX, EXERCISE_NAME_MAX, type ExerciseType } from "@better-health/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, ArrowDown, ArrowLeft, ArrowUp, Pencil, Tags } from "lucide-react";
import { type ChangeEvent, type FormEvent, type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { labelTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { categoriesOf, exerciseTypesQuery, useLabelMutations } from "./queries";

const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : e ? "Something went wrong" : null;

export function LabelsPage() {
  const { data, isPending, isError, refetch } = useQuery(exerciseTypesQuery(true));
  const mutations = useLabelMutations();
  const active = data?.filter((t) => !t.archived) ?? [];
  const archived = data?.filter((t) => t.archived) ?? [];
  const error = errorText(mutations.update.error ?? mutations.reorder.error);
  // Suggestions for the category fields, from the categories already in use.
  const categoryList = useId();

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
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="rounded-full" asChild>
          <Link to="/" aria-label="Back to calendar">
            <ArrowLeft />
          </Link>
        </Button>
        <span className="grid size-9 place-items-center rounded-xl bg-sky-500 text-white shadow-md shadow-sky-500/30">
          <Tags className="size-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">Exercise labels</h1>
      </div>

      <datalist id={categoryList}>
        {categoriesOf(data ?? []).map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <AddLabelForm categoryList={categoryList} />

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
          <h2
            id="active-heading"
            className="text-sm font-bold tracking-wide text-violet-800 uppercase"
          >
            Active
          </h2>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No labels yet. Add one above.</p>
          ) : (
            <ul aria-labelledby="active-heading" className="space-y-2">
              {active.map((t, i) => (
                <LabelRow key={t.id} label={t} categoryList={categoryList}>
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
          <h2
            id="archived-heading"
            className="text-sm font-bold tracking-wide text-violet-800 uppercase"
          >
            Archived
          </h2>
          <p className="text-xs text-muted-foreground">
            Hidden from the picker; past entries still show them.
          </p>
          <ul aria-labelledby="archived-heading" className="space-y-2">
            {archived.map((t) => (
              <LabelRow key={t.id} label={t} categoryList={categoryList}>
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

interface LabelFields {
  name: string;
  category: string;
}

const trimmed = (f: LabelFields): LabelFields => ({
  name: f.name.trim(),
  category: f.category.trim(),
});
const complete = (f: LabelFields) => Boolean(f.name.trim() && f.category.trim());

/** Name and category inputs, shared by the add and edit forms. */
function LabelInputs({
  value,
  onChange,
  categoryList,
  autoFocus,
}: {
  value: LabelFields;
  onChange: (next: LabelFields) => void;
  categoryList: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const set = (key: keyof LabelFields) => (e: ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: e.target.value });
  return (
    <div className="grid min-w-0 flex-1 basis-full grid-cols-2 gap-2 sm:basis-0 sm:grid-cols-[3fr_2fr]">
      <div className="space-y-1">
        <Label htmlFor={`${id}-name`} className="text-xs">
          Exercise
        </Label>
        <Input
          id={`${id}-name`}
          placeholder="e.g. Walking"
          value={value.name}
          maxLength={EXERCISE_NAME_MAX}
          autoFocus={autoFocus}
          onChange={set("name")}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-category`} className="text-xs">
          Category
        </Label>
        <Input
          id={`${id}-category`}
          placeholder="e.g. cardio"
          list={categoryList}
          autoComplete="off"
          value={value.category}
          maxLength={EXERCISE_CATEGORY_MAX}
          onChange={set("category")}
        />
      </div>
    </div>
  );
}

const EMPTY: LabelFields = { name: "", category: "" };

function AddLabelForm({ categoryList }: { categoryList: string }) {
  const { create } = useLabelMutations();
  const [fields, setFields] = useState(EMPTY);
  const ready = complete(fields);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    create.mutate(trimmed(fields), { onSuccess: () => setFields(EMPTY) });
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Add label"
      className="space-y-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-violet-100"
    >
      <div className="flex flex-wrap items-end gap-2">
        <LabelInputs
          value={fields}
          categoryList={categoryList}
          onChange={(next) => {
            setFields(next);
            create.reset();
          }}
        />
        <Button type="submit" className="w-full sm:w-auto" disabled={!ready || create.isPending}>
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

function LabelRow({
  label,
  categoryList,
  children,
}: {
  label: ExerciseType;
  categoryList: string;
  children: ReactNode;
}) {
  const { update } = useLabelMutations();
  const [editing, setEditing] = useState(false);
  const saved: LabelFields = { name: label.name, category: label.category };
  const [fields, setFields] = useState(saved);

  function cancel() {
    setEditing(false);
    setFields(saved);
    update.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!complete(fields)) return;
    const next = trimmed(fields);
    if (next.name === label.name && next.category === label.category) {
      return cancel();
    }
    update.mutate({ id: label.id, ...next }, { onSuccess: () => setEditing(false) });
  }

  if (editing) {
    return (
      <li className="space-y-1 rounded-2xl bg-white p-3 shadow-sm ring-2 ring-violet-300">
        <form
          onSubmit={submit}
          onKeyDown={(e) => e.key === "Escape" && cancel()}
          aria-label={`Edit ${label.name}`}
          className="flex flex-wrap items-end gap-2"
        >
          <LabelInputs value={fields} onChange={setFields} categoryList={categoryList} autoFocus />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!complete(fields) || update.isPending}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
          </div>
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
    <li
      className={cn(
        "flex items-center gap-1 rounded-2xl bg-white p-1.5 pl-3 text-sm shadow-xs ring-1 ring-violet-100",
        label.archived && "bg-white/60",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mr-1 size-3 shrink-0 rounded-full",
          label.archived ? "bg-slate-300" : labelTone(label.id).dot,
        )}
      />
      <span className="min-w-0 flex-1 break-words">
        <span className="font-medium">{label.name}</span>
        {label.category ? (
          <span className="text-muted-foreground"> · {label.category}</span>
        ) : (
          <span className="text-destructive"> · no category, edit to add one</span>
        )}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit ${label.name}`}
        onClick={() => setEditing(true)}
      >
        <Pencil />
      </Button>
      {children}
    </li>
  );
}
