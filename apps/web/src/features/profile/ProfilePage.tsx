import {
  HIGHLIGHT_COLORS,
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
  ChevronDown,
  Paintbrush,
  Trash2,
  UserRound,
} from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exerciseTypesQuery } from "@/features/labels/queries";
import { ApiError } from "@/lib/api";
import { highlightTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import {
  describeRule,
  highlightsQuery,
  METRIC_NAMES,
  OPERATOR_TEXT,
  useHighlightMutations,
} from "./highlights";

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

      <Highlights />
    </main>
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
            const tone = highlightTone[rule.color];
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

/** Metric picker values: the four day metrics, or "exercise:<label id>". */
function toRule(
  metric: string,
  operator: HighlightOperator,
  amount: string,
  color: HighlightColor,
): { rule?: HighlightRuleCreate; amountError?: string } {
  const text = amount.trim();
  if (!text) return {};
  if (!AMOUNT_PATTERN.test(text)) return { amountError: "Enter a number, like 200 or -500" };
  const exerciseId = metric.startsWith("exercise:") ? Number(metric.slice(9)) : null;
  const parsed = highlightRuleCreateSchema.safeParse({
    metric: exerciseId === null ? metric : "exercise",
    exerciseTypeId: exerciseId,
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
            {labels.length > 0 && (
              <optgroup label="Exercises">
                {labels.map((l) => (
                  <option key={l.id} value={`exercise:${l.id}`}>
                    {[l.name, l.category, l.unit].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </optgroup>
            )}
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

      <fieldset className="space-y-1">
        <legend className="text-xs font-medium">Color</legend>
        <div className="flex flex-wrap gap-2">
          {HIGHLIGHT_COLORS.map((c) => {
            const tone = highlightTone[c];
            return (
              <label
                key={c}
                title={tone.name}
                className={cn(
                  "grid size-10 cursor-pointer place-items-center rounded-lg ring-2 transition-transform has-[:checked]:scale-110 has-[:checked]:ring-violet-700 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                  tone.cell,
                  tone.ring,
                )}
              >
                <input
                  type="radio"
                  name={`${id}-color`}
                  value={c}
                  checked={color === c}
                  onChange={() => change(() => setColor(c))}
                  className="sr-only"
                />
                <span className="sr-only">{tone.name}</span>
                {color === c && (
                  <span aria-hidden="true" className="size-2.5 rounded-full bg-violet-900" />
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

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

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-md border border-input bg-white py-0 pr-9 pl-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-violet-700"
      />
    </div>
  );
}
