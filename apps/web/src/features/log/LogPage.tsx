import {
  type DayDetail,
  formatAmount,
  formatNumber,
  formatWeight,
  measurementText,
} from "@better-health/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeft, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import { metricTone, netTone } from "@/lib/tones";
import { cn } from "@/lib/utils";

export const logQuery = queryOptions({
  queryKey: ["log"],
  queryFn: (): Promise<DayDetail[]> => unwrap(api.log.$get()),
});

const DATE_WITH_YEAR = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const logRoute = getRouteApi("/authed/log");

/**
 * Everything logged, one card per day, newest first. Today is always listed, even before
 * anything is logged for it. Read only: days are edited in the day panel.
 */
export function LogPage() {
  const today = logRoute.useRouteContext().today();
  const { data, isPending, isError, refetch } = useQuery(logQuery);

  const days = data ?? [];
  const withToday = days.some((d) => d.date === today)
    ? days
    : [...days, emptyDay(today)].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="rounded-full" asChild>
          <Link to="/" aria-label="Back to calendar">
            <ArrowLeft />
          </Link>
        </Button>
        <span className="grid size-9 place-items-center rounded-xl bg-sky-500 text-white shadow-md shadow-sky-500/30">
          <ScrollText className="size-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">Log</h1>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && (
        <div role="alert" className="flex items-center gap-2 text-sm">
          Could not load the log.
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <ol aria-label="Log, newest first" className="space-y-3">
          {withToday.map((day) => (
            <li key={day.date}>
              <LogDay day={day} isToday={day.date === today} />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function emptyDay(date: string): DayDetail {
  return {
    date,
    caloriesIn: null,
    caloriesActive: null,
    caloriesBase: 0,
    caloriesOut: null,
    net: null,
    weightLbs: null,
    steps: null,
    distanceMiles: null,
    note: null,
    exercises: [],
  };
}

function LogDay({ day, isToday }: { day: DayDetail; isToday: boolean }) {
  const headingId = `log-${day.date}`;
  const baseCounts = day.caloriesOut !== null && day.caloriesBase > 0;
  const metrics = [
    day.caloriesIn !== null && {
      label: "In",
      value: `${formatNumber(day.caloriesIn)} cal`,
      text: metricTone.in.text,
    },
    // Active and base only when a base counts toward the day; otherwise "Out" is all there is.
    baseCounts && {
      label: "Active",
      value: `${formatNumber(day.caloriesActive ?? 0)} cal`,
      text: metricTone.out.text,
    },
    baseCounts && {
      label: "Base",
      value: `${formatNumber(day.caloriesBase)} cal`,
      text: metricTone.out.text,
    },
    day.caloriesOut !== null && {
      label: "Out",
      value: `${formatNumber(day.caloriesOut)} cal`,
      text: metricTone.out.text,
    },
    day.net !== null && {
      label: "Net",
      value: `${formatNumber(day.net, { signed: true })} cal`,
      text: netTone(day.net).text,
    },
    day.weightLbs !== null && {
      label: "Weight",
      value: `${formatWeight(day.weightLbs)} lbs`,
      text: metricTone.weight.text,
    },
    day.steps !== null && {
      label: "Steps",
      value: formatNumber(day.steps),
      text: metricTone.steps.text,
    },
    day.distanceMiles !== null && {
      label: "Distance",
      value: `${formatAmount(day.distanceMiles)} mi`,
      text: metricTone.distance.text,
    },
  ].filter((m) => m !== false);
  const empty = metrics.length === 0 && day.exercises.length === 0 && !day.note;

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-violet-100",
        isToday && "ring-2 ring-sky-300",
      )}
    >
      <h2 id={headingId} className="flex items-center gap-2 text-sm font-bold text-violet-800">
        <Link
          to="/calendar/$month"
          params={{ month: day.date.slice(0, 7) }}
          search={{ day: day.date }}
          className="hover:underline"
        >
          <time dateTime={day.date}>
            {DATE_WITH_YEAR.format(new Date(`${day.date}T00:00:00Z`))}
          </time>
        </Link>
        {isToday && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">
            Today
          </span>
        )}
      </h2>

      {empty && (
        <p className="text-sm text-muted-foreground">
          Nothing logged yet.{" "}
          <Link
            to="/calendar/$month"
            params={{ month: day.date.slice(0, 7) }}
            search={{ day: day.date }}
            className="font-semibold text-violet-800 underline"
          >
            Log today
          </Link>
        </p>
      )}

      {metrics.length > 0 && (
        <dl className="flex flex-wrap gap-x-5 gap-y-1">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-baseline gap-1.5">
              <dt className="text-xs font-medium text-muted-foreground">{m.label}</dt>
              <dd className={cn("font-bold tabular-nums", m.text)}>{m.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {day.exercises.length > 0 && (
        <ul aria-label="Exercises" className="space-y-1">
          {day.exercises.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{entry.name}</span>
                {entry.category && (
                  <span className="mx-1.5 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">
                    {entry.category}
                  </span>
                )}
                {entry.archived && <span className="text-muted-foreground"> (archived)</span>}
                {entry.measurements.length > 0 && (
                  <span className="text-muted-foreground">
                    {" – "}
                    <span className="font-semibold text-foreground tabular-nums">
                      {entry.measurements.map(measurementText).join(", ")}
                    </span>
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {day.note && (
        <p className="whitespace-pre-wrap break-words border-l-4 border-amber-400 pl-3 text-sm leading-relaxed">
          {day.note}
        </p>
      )}
    </article>
  );
}
