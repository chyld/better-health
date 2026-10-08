import {
  baseCaloriesOn,
  baseCaloriesSchema,
  formatNumber,
  HIGHLIGHT_OPERATORS,
  type HighlightColor,
  type HighlightOperator,
  type HighlightRuleCreate,
  highlightRuleCreateSchema,
} from "@better-health/shared";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Clock,
  Flame,
  Paintbrush,
  Trash2,
  UserRound,
} from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { meQuery, useSetTimeZone } from "@/features/auth/queries";
import { exerciseTypesQuery } from "@/features/labels/queries";
import { ApiError } from "@/lib/api";
import { paletteTone } from "@/lib/palette";
import { metricTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { baseCaloriesQuery, useSetBaseCalories } from "./baseCalories";
import { CellFieldsSection } from "./CellFieldsSection";
import { ColorGrid } from "./ColorGrid";
import { Field, Select } from "./controls";
import {
  describeRule,
  highlightsQuery,
  METRIC_NAMES,
  OPERATOR_TEXT,
  useHighlightMutations,
} from "./highlights";
import { Versions } from "./Versions";

const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : e ? "Something went wrong" : null;

const profileRoute = getRouteApi("/authed/profile");

export function ProfilePage() {
  const { user } = profileRoute.useRouteContext();
  return (
    <main className="mx-auto w-full max-w-xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="rounded-full" asChild>
          <Link to="/" aria-label="Back to calendar">
            <ArrowLeft />
          </Link>
        </Button>
        <span className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-orange-400 to-pink-500 text-white shadow-md shadow-pink-500/30">
          <UserRound className="size-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">Profile</h1>
      </div>

      <section
        aria-label="Account"
        className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-violet-100"
      >
        <span
          aria-hidden="true"
          className="grid size-11 place-items-center rounded-full bg-linear-to-br from-orange-400 to-pink-500 text-lg font-bold text-white uppercase"
        >
          {user.username.slice(0, 1)}
        </span>
        <div>
          <p className="text-lg font-bold">{user.username}</p>
          <p className="text-sm text-muted-foreground">{user.isAdmin ? "Admin" : "Member"}</p>
        </div>
      </section>

      <TimeZone />

      <BaseCalories />

      <CellFieldsSection />

      <Highlights />

      <Versions />
    </main>
  );
}

/** Every zone the browser knows, plus UTC, which some browsers leave out. */
function timeZones(current: string): string[] {
  const zones = new Set(["UTC", ...Intl.supportedValuesOf("timeZone"), current]);
  return [...zones].sort((a, b) => (a === "UTC" ? -1 : b === "UTC" ? 1 : a.localeCompare(b)));
}

function TimeZone() {
  const id = useId();
  const { user } = profileRoute.useRouteContext();
  const timeZone = useQuery(meQuery).data?.timeZone ?? user.timeZone;
  const set = useSetTimeZone();
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <section
      aria-labelledby="zone-heading"
      className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-violet-100"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700">
          <Clock className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h2 id="zone-heading" className="text-lg font-bold">
            Time zone
          </h2>
          <p className="text-sm text-muted-foreground">
            Decides when your day starts. You can change today and the 2 days before it; older days
            are locked.
          </p>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-zone`} className="text-xs">
          Time zone
        </Label>
        <Select id={`${id}-zone`} value={timeZone} onChange={(zone) => set.mutate(zone)}>
          {timeZones(timeZone).map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </div>
      {device && device !== timeZone && (
        <Button
          variant="outline"
          size="sm"
          disabled={set.isPending}
          onClick={() => set.mutate(device)}
        >
          Use this device's time zone ({device.replaceAll("_", " ")})
        </Button>
      )}
      {set.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(set.error)}
        </p>
      )}
    </section>
  );
}

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const longDate = (date: string) => LONG_DATE.format(new Date(`${date}T00:00:00Z`));

function BaseCalories() {
  const id = useId();
  const today = profileRoute.useRouteContext().today();
  const { data, isError, refetch } = useQuery(baseCaloriesQuery);
  const set = useSetBaseCalories();
  const current = data ? baseCaloriesOn(data, today) : 0;
  // null until edited: the field shows the base in effect today.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (current ? String(current) : "");

  const trimmed = text.trim();
  const parsed = /^\d+$/.test(trimmed)
    ? baseCaloriesSchema.safeParse(Number(trimmed))
    : trimmed === ""
      ? baseCaloriesSchema.safeParse(0)
      : null;
  const inputError = parsed
    ? parsed.success
      ? null
      : (parsed.error.issues[0]?.message ?? "Invalid")
    : "Enter a whole number, like 2000";
  const value = parsed?.success ? parsed.data : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (value === null) return;
    set.mutate({ calories: value, startsOn: today }, { onSuccess: () => setDraft(null) });
  }

  return (
    <section
      aria-labelledby="base-heading"
      className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-violet-100"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn("grid size-10 shrink-0 place-items-center rounded-xl", metricTone.out.icon)}
        >
          <Flame className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h2 id="base-heading" className="text-lg font-bold">
            Base calorie burn
          </h2>
          <p className="text-sm text-muted-foreground">
            What your body burns in a day at rest, about 2,000 for many people. It is added to the
            active calories you log, on every day with calories entered. A change counts from today
            on; earlier days keep the base they had.
          </p>
        </div>
      </div>

      {isError && (
        <div role="alert" className="flex items-center gap-2 text-sm">
          Could not load your base burn.
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <form onSubmit={submit} aria-label="Base calorie burn" className="space-y-2">
          <Label htmlFor={`${id}-base`} className="text-xs">
            Calories a day
          </Label>
          <div className="flex gap-2">
            <div className="relative w-40">
              <Input
                id={`${id}-base`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 2000"
                value={text}
                aria-invalid={inputError ? true : undefined}
                aria-describedby={inputError ? `${id}-base-error` : undefined}
                onChange={(e) => {
                  setDraft(e.target.value);
                  set.reset();
                }}
                className="pr-10 text-right tabular-nums"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                cal
              </span>
            </div>
            <Button type="submit" disabled={value === null || value === current || set.isPending}>
              Save
            </Button>
          </div>
          {inputError && (
            <p id={`${id}-base-error`} className="text-xs text-destructive">
              {inputError}
            </p>
          )}
          {set.error && (
            <p role="alert" className="text-sm text-destructive">
              {errorText(set.error)}
            </p>
          )}
          {data.length > 0 && (
            <ul aria-label="Base burn changes" className="space-y-0.5 pt-1 text-sm">
              {data.map((c) => (
                <li key={c.startsOn}>
                  <span className="font-semibold tabular-nums">{formatNumber(c.calories)} cal</span>
                  <span className="text-muted-foreground"> from {longDate(c.startsOn)}</span>
                </li>
              ))}
            </ul>
          )}
        </form>
      )}
    </section>
  );
}

function Highlights() {
  const { data, isPending, isError, refetch } = useQuery(highlightsQuery);
  const labels = useQuery(exerciseTypesQuery(true)).data ?? [];
  const mutations = useHighlightMutations();
  const rules = data ?? [];
  const error = errorText(mutations.remove.error ?? mutations.reorder.error);
  const busy = mutations.remove.isPending || mutations.reorder.isPending;

  function move(index: number, delta: -1 | 1) {
    const ids = rules.map((r) => r.id);
    const [moved] = ids.splice(index, 1);
    if (moved === undefined) return;
    ids.splice(index + delta, 0, moved);
    mutations.reorder.mutate(ids);
  }

  return (
    <section
      aria-labelledby="highlights-heading"
      className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-violet-100"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-fuchsia-100 text-fuchsia-700">
          <Paintbrush className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h2 id="highlights-heading" className="text-lg font-bold">
            Calendar highlights
          </h2>
          <p className="text-sm text-muted-foreground">
            Color a day on the calendar when it meets a condition, such as weight under 200. When a
            day meets several, the first one in the list wins. Days with nothing logged for the
            metric are never colored.
          </p>
        </div>
      </div>

      <AddRuleForm />

      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && (
        <div role="alert" className="flex items-center gap-2 text-sm">
          Could not load highlights.
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
      {data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No highlights yet. Add one above.</p>
      )}
      {rules.length > 0 && (
        <ol aria-label="Highlights, first match wins" className="space-y-2">
          {rules.map((rule, i) => {
            const text = describeRule(rule, labels);
            const tone = paletteTone[rule.color];
            return (
              <li
                key={rule.id}
                className="flex items-center gap-2 rounded-xl p-2 pl-3 ring-1 ring-violet-100"
              >
                <span
                  aria-hidden="true"
                  className={cn("size-6 shrink-0 rounded-md ring-2", tone.cell, tone.ring)}
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{text}</span>
                  <span className="text-muted-foreground"> · {tone.name}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Move ${text} up`}
                  disabled={i === 0 || busy}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Move ${text} down`}
                  disabled={i === rules.length - 1 || busy}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${text}`}
                  disabled={busy}
                  onClick={() => mutations.remove.mutate(rule.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

const AMOUNT_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * Metric picker values: the four day metrics, "exercise:<label id>" to count how many times
 * it was logged, or "exercise:<label id>:<unit>" to total a unit measured with it.
 */
function toRule(
  metric: string,
  operator: HighlightOperator,
  amount: string,
  color: HighlightColor,
): { rule?: HighlightRuleCreate; amountError?: string } {
  const text = amount.trim();
  if (!text) return {};
  if (!AMOUNT_PATTERN.test(text)) return { amountError: "Enter a number, like 200 or -500" };
  const [kind, labelId, unit] = metric.split(":");
  const exerciseId = kind === "exercise" ? Number(labelId) : null;
  const parsed = highlightRuleCreateSchema.safeParse({
    metric: exerciseId === null ? metric : "exercise",
    exerciseTypeId: exerciseId,
    unit: unit ?? null,
    operator,
    target: Number(text),
    color,
  });
  if (parsed.success) return { rule: parsed.data };
  const targetIssue = parsed.error.issues.find((i) => i.path[0] === "target");
  return { amountError: targetIssue?.message };
}

function AddRuleForm() {
  const id = useId();
  const { create } = useHighlightMutations();
  const labels = useQuery(exerciseTypesQuery()).data ?? [];
  const [metric, setMetric] = useState("weight");
  const [operator, setOperator] = useState<HighlightOperator>("<");
  const [amount, setAmount] = useState("");
  const [color, setColor] = useState<HighlightColor>("green");
  const { rule, amountError } = toRule(metric, operator, amount, color);

  function change(apply: () => void) {
    apply();
    create.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!rule) return;
    create.mutate(rule, { onSuccess: () => setAmount("") });
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Add highlight"
      className="space-y-3 rounded-xl bg-violet-50/60 p-3 ring-1 ring-violet-100"
    >
      <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto_8rem]">
        <Field label="Metric" htmlFor={`${id}-metric`} className="col-span-2 sm:col-span-1">
          <Select id={`${id}-metric`} value={metric} onChange={(v) => change(() => setMetric(v))}>
            {Object.entries(METRIC_NAMES).map(([value, name]) => (
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
        <Field label="Condition" htmlFor={`${id}-operator`}>
          <Select
            id={`${id}-operator`}
            value={operator}
            onChange={(v) => change(() => setOperator(v as HighlightOperator))}
          >
            {HIGHLIGHT_OPERATORS.map((op) => (
              <option key={op} value={op}>
                {OPERATOR_TEXT[op]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount" htmlFor={`${id}-amount`}>
          <Input
            id={`${id}-amount`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 200"
            value={amount}
            aria-invalid={amountError ? true : undefined}
            aria-describedby={amountError ? `${id}-amount-error` : undefined}
            onChange={(e) => change(() => setAmount(e.target.value))}
          />
        </Field>
      </div>
      {amountError && (
        <p id={`${id}-amount-error`} className="text-xs text-destructive">
          {amountError}
        </p>
      )}

      <ColorGrid
        name={`${id}-color`}
        legend="Color"
        swatch="cell"
        value={color}
        onChange={(c) => c && change(() => setColor(c))}
      />

      <Button type="submit" className="w-full sm:w-auto" disabled={!rule || create.isPending}>
        Add highlight
      </Button>
      {create.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(create.error)}
        </p>
      )}
    </form>
  );
}
