import { formatNumber, formatWeight, type HistoryDay } from "@better-health/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, History } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import { metricTone, netTone } from "@/lib/tones";
import { cn } from "@/lib/utils";

export const historyQuery = queryOptions({
  queryKey: ["history"],
  queryFn: (): Promise<HistoryDay[]> => unwrap(api.history.$get()),
});

export const METRIC_IDS = ["in", "out", "net", "weight"] as const;
export type MetricId = (typeof METRIC_IDS)[number];

interface Metric {
  label: string;
  value: (day: HistoryDay) => number | null;
  format: (n: number) => string;
  unit: string;
  /** Text and bar colours for one value. */
  tone: (n: number) => { text: string; bar: string };
}

const METRICS: Record<MetricId, Metric> = {
  in: {
    label: "Calories in",
    value: (d) => d.caloriesIn,
    format: (n) => formatNumber(n),
    unit: "cal",
    tone: () => ({ text: metricTone.in.text, bar: "bg-orange-400" }),
  },
  out: {
    label: "Calories out",
    value: (d) => d.caloriesOut,
    format: (n) => formatNumber(n),
    unit: "cal",
    tone: () => ({ text: metricTone.out.text, bar: "bg-pink-400" }),
  },
  net: {
    label: "Net calories",
    value: (d) => d.net,
    format: (n) => formatNumber(n, { signed: true }),
    unit: "cal",
    tone: (n) => ({
      text: netTone(n).text,
      bar: n < 0 ? "bg-emerald-400" : n > 0 ? "bg-orange-400" : "bg-slate-300",
    }),
  },
  weight: {
    label: "Weight",
    value: (d) => d.weightLbs,
    format: formatWeight,
    unit: "lbs",
    tone: () => ({ text: metricTone.weight.text, bar: "bg-violet-400" }),
  },
};

const DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const historyRoute = getRouteApi("/authed/history");

/** Every logged value of one metric, newest first; the drop-down picks the metric. */
export function HistoryPage() {
  const { metric: chosen } = historyRoute.useSearch();
  const metricId: MetricId = chosen ?? "in";
  const metric = METRICS[metricId];
  const navigate = useNavigate({ from: "/history" });
  const selectId = useId();
  const { data, isPending, isError, refetch } = useQuery(historyQuery);

  const rows = (data ?? []).flatMap((day) => {
    const value = metric.value(day);
    return value === null ? [] : [{ date: day.date, value }];
  });
  const largest = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const average = rows.length ? rows.reduce((sum, r) => sum + r.value, 0) / rows.length : null;
  const formatAverage = (n: number) =>
    metricId === "weight" ? formatWeight(Math.round(n * 10) / 10) : metric.format(Math.round(n));

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="rounded-full" asChild>
          <Link to="/" aria-label="Back to calendar">
            <ArrowLeft />
          </Link>
        </Button>
        <span className="grid size-9 place-items-center rounded-xl bg-pink-500 text-white shadow-md shadow-pink-500/30">
          <History className="size-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">History</h1>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-violet-100">
        <div className="flex items-center gap-3">
          <label htmlFor={selectId} className="text-sm font-semibold text-violet-900">
            Show
          </label>
          <div className="relative">
            <select
              id={selectId}
              value={metricId}
              onChange={(e) =>
                navigate({ search: { metric: e.target.value as MetricId }, replace: true })
              }
              className="h-10 appearance-none rounded-xl border border-violet-200 bg-white py-0 pr-10 pl-3 text-base font-semibold text-violet-900 shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {METRIC_IDS.map((id) => (
                <option key={id} value={id}>
                  {METRICS[id].label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-violet-700"
            />
          </div>
        </div>
        {average !== null && (
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "day" : "days"} · average{" "}
            <span className="font-bold text-foreground tabular-nums">
              {formatAverage(average)} {metric.unit}
            </span>
          </p>
        )}
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && (
        <div role="alert" className="flex items-center gap-2 text-sm">
          Could not load history.
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}
      {data && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No {metric.label.toLowerCase()} logged yet. Add some from a day on the calendar.
        </p>
      )}

      {rows.length > 0 && (
        <ol
          aria-label={`${metric.label}, newest first`}
          className="divide-y divide-violet-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-violet-100"
        >
          {rows.map((r) => {
            const tone = metric.tone(r.value);
            return (
              <li key={r.date} className="flex items-center gap-3 px-4 py-2.5">
                <Link
                  to="/calendar/$month"
                  params={{ month: r.date.slice(0, 7) }}
                  search={{ day: r.date }}
                  className="w-32 shrink-0 text-sm font-medium hover:underline sm:w-36"
                >
                  <time dateTime={r.date}>{DATE.format(new Date(`${r.date}T00:00:00Z`))}</time>
                </Link>
                <span aria-hidden="true" className="h-2 min-w-0 flex-1 rounded-full bg-violet-50">
                  <span
                    className={cn("block h-full rounded-full", tone.bar)}
                    style={{ width: `${Math.max(2, (Math.abs(r.value) / largest) * 100)}%` }}
                  />
                </span>
                <span
                  data-value={metricId}
                  className={cn("w-24 shrink-0 text-right font-bold tabular-nums", tone.text)}
                >
                  {metric.format(r.value)}{" "}
                  <span className="text-xs font-medium text-muted-foreground">{metric.unit}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
