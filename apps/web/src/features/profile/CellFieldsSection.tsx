import {
  CELL_CAPTION_MAX,
  type CellField,
  type CellFieldCreate,
  type CellMetric,
  cellCaptionSchema,
  cellFieldCreateSchema,
  cellValue,
  type DaySummary,
  type ExerciseType,
  suggestCaption,
} from "@better-health/shared";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, LayoutGrid, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DayCell } from "@/features/calendar/DayCell";
import { exerciseTypesQuery } from "@/features/labels/queries";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CELL_METRIC_NAMES,
  cellFieldsQuery,
  cellTone,
  describeField,
  useCellFieldMutations,
} from "./cellFields";
import { Field, Select } from "./controls";

const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : e ? "Something went wrong" : null;

const profileRoute = getRouteApi("/authed/profile");

/** Choose what each calendar cell shows, in order, with a caption for each value. */
export function CellFieldsSection() {
  const { data, isPending, isError, refetch } = useQuery(cellFieldsQuery);
  const labels = useQuery(exerciseTypesQuery(true)).data ?? [];
  const mutations = useCellFieldMutations();
  const fields = data ?? [];
  const error = errorText(
    mutations.remove.error ?? mutations.reorder.error ?? mutations.rename.error,
  );
  const busy = mutations.remove.isPending || mutations.reorder.isPending;

  function move(index: number, delta: -1 | 1) {
    const ids = fields.map((f) => f.id);
    const [moved] = ids.splice(index, 1);
    if (moved === undefined) return;
    ids.splice(index + delta, 0, moved);
    mutations.reorder.mutate(ids);
  }

  return (
    <section
      aria-labelledby="cells-heading"
      className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-violet-100"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
          <LayoutGrid className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h2 id="cells-heading" className="text-lg font-bold">
            Calendar cells
          </h2>
          <p className="text-sm text-muted-foreground">
            Choose what each day on the calendar shows, in order, and the caption before each value.
            Cells grow to fit; a day skips any value it has nothing logged for.
          </p>
        </div>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && (
        <div role="alert" className="flex items-center gap-2 text-sm">
          Could not load calendar cells.
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <div className="grid gap-4 sm:grid-cols-[1fr_8.5rem]">
          <div className="min-w-0 space-y-4">
            <AddFieldForm />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Cells show only the date. Add a value above.
              </p>
            ) : (
              <ol aria-label="Calendar cell values, in order" className="space-y-2">
                {fields.map((field, i) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    labels={labels}
                    first={i === 0}
                    last={i === fields.length - 1}
                    busy={busy}
                    onMove={(delta) => move(i, delta)}
                  />
                ))}
              </ol>
            )}
          </div>
          <Preview fields={fields} />
        </div>
      )}
    </section>
  );
}

function FieldRow({
  field,
  labels,
  first,
  last,
  busy,
  onMove,
}: {
  field: CellField;
  labels: readonly ExerciseType[];
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
}) {
  const { remove } = useCellFieldMutations();
  const text = describeField(field, labels);
  return (
    <li className="flex items-center gap-2 rounded-xl p-1.5 pl-2 ring-1 ring-violet-100">
      <CaptionInput field={field} name={text} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{text}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Move ${text} up`}
        disabled={first || busy}
        onClick={() => onMove(-1)}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Move ${text} down`}
        disabled={last || busy}
        onClick={() => onMove(1)}
      >
        <ArrowDown />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${text}`}
        disabled={busy}
        onClick={() => remove.mutate(field.id)}
      >
        <Trash2 />
      </Button>
    </li>
  );
}

/** The caption, in the value's colours; it saves on Enter or when it loses focus. */
function CaptionInput({ field, name }: { field: CellField; name: string }) {
  const { rename } = useCellFieldMutations();
  const [text, setText] = useState(field.caption);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setText(field.caption), [field.caption]);

  function commit() {
    const parsed = cellCaptionSchema.safeParse(text);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid");
      return;
    }
    setError(null);
    setText(parsed.data);
    if (parsed.data !== field.caption) rename.mutate({ id: field.id, caption: parsed.data });
  }

  return (
    <Input
      aria-label={`Caption for ${name}`}
      title={error ?? undefined}
      aria-invalid={error ? true : undefined}
      value={text}
      maxLength={CELL_CAPTION_MAX}
      autoComplete="off"
      onChange={(e) => {
        setText(e.target.value);
        setError(null);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      className={cn(
        "h-8 w-[4.5rem] shrink-0 border-0 px-2 text-sm font-semibold shadow-none",
        cellTone(field, -1),
        error && "ring-2 ring-destructive",
      )}
    />
  );
}

/**
 * Picker values: a day metric, "exercise:<label id>" to count how many times it was logged, or
 * "exercise:<label id>:<unit>" to total a unit measured with it.
 */
function parsePick(pick: string): Pick<CellFieldCreate, "metric" | "exerciseTypeId" | "unit"> {
  const [kind, labelId, unit] = pick.split(":");
  if (kind !== "exercise") return { metric: kind as CellMetric, exerciseTypeId: null, unit: null };
  return { metric: "exercise", exerciseTypeId: Number(labelId), unit: unit ?? null };
}

function AddFieldForm() {
  const id = useId();
  const { create } = useCellFieldMutations();
  const labels = useQuery(exerciseTypesQuery()).data ?? [];
  const [pick, setPick] = useState("in");
  // Follows the picked value until the user types their own.
  const [caption, setCaption] = useState<string | null>(null);

  const picked = parsePick(pick);
  const label = labels.find((l) => l.id === picked.exerciseTypeId);
  const shown = caption ?? suggestCaption(picked.metric, label?.name);
  const parsed = cellFieldCreateSchema.safeParse({ ...picked, caption: shown });
  const captionError = parsed.success
    ? null
    : (parsed.error.issues.find((i) => i.path[0] === "caption")?.message ?? null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!parsed.success) return;
    create.mutate(parsed.data, { onSuccess: () => setCaption(null) });
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Add a calendar cell value"
      className="space-y-3 rounded-xl bg-violet-50/60 p-3 ring-1 ring-violet-100"
    >
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Field label="Value" htmlFor={`${id}-value`}>
          <Select
            id={`${id}-value`}
            value={pick}
            onChange={(v) => {
              setPick(v);
              setCaption(null);
              create.reset();
            }}
          >
            {Object.entries(CELL_METRIC_NAMES).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
            {labels.map((l) => (
              <optgroup key={l.id} label={[l.name, l.category].filter(Boolean).join(" · ")}>
                <option value={`exercise:${l.id}`}>{l.name} · times logged</option>
                {l.units.map((u) => (
                  <option key={u} value={`exercise:${l.id}:${u}`}>
                    {l.name} · {u}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Caption" htmlFor={`${id}-caption`}>
          <Input
            id={`${id}-caption`}
            autoComplete="off"
            value={shown}
            maxLength={CELL_CAPTION_MAX}
            aria-invalid={captionError ? true : undefined}
            aria-describedby={captionError ? `${id}-caption-error` : undefined}
            onChange={(e) => {
              setCaption(e.target.value);
              create.reset();
            }}
          />
        </Field>
      </div>
      {captionError && (
        <p id={`${id}-caption-error`} className="text-xs text-destructive">
          {captionError}
        </p>
      )}
      <Button
        type="submit"
        className="w-full sm:w-auto"
        disabled={!parsed.success || create.isPending}
      >
        Add to cells
      </Button>
      {create.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(create.error)}
        </p>
      )}
    </form>
  );
}

/** A day with something for every field, so the preview shows them all. */
function sampleDay(date: string, fields: readonly CellField[]): DaySummary {
  return {
    date,
    caloriesIn: 2150,
    caloriesActive: 650,
    caloriesBase: 2000,
    caloriesOut: 2650,
    net: -500,
    weightLbs: 182.4,
    steps: 9876,
    distanceMiles: 4.2,
    exerciseCount: 2,
    exerciseTotals: fields.flatMap((f) =>
      f.metric === "exercise" && f.exerciseTypeId !== null
        ? [{ exerciseTypeId: f.exerciseTypeId, unit: f.unit, amount: f.unit ? 3.5 : 1 }]
        : [],
    ),
    hasNote: false,
  };
}

/** How a cell looks with these fields, at this screen size, with sample values. */
function Preview({ fields }: { fields: readonly CellField[] }) {
  const today = profileRoute.useRouteContext().today();
  const day = sampleDay(today, fields);
  const shown = fields.filter((f) => cellValue(day, f) !== null);
  return (
    <figure className="space-y-1.5 sm:order-last">
      <figcaption className="text-xs font-medium text-muted-foreground">
        Preview, with sample values
      </figcaption>
      {/* A picture of a cell: not something to click or tab to. */}
      <div inert aria-hidden="true" className="w-24 sm:w-full">
        <DayCell
          day={day}
          fields={shown}
          isToday={false}
          isFuture={false}
          isSelected={false}
          tabIndex={-1}
          onSelect={() => {}}
        />
      </div>
    </figure>
  );
}
