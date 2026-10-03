import type { DayNote } from "@better-health/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";

export const notesQuery = queryOptions({
  queryKey: ["notes"],
  queryFn: (): Promise<DayNote[]> => unwrap(api.notes.$get()),
});

const DATE_WITH_YEAR = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** Every note, newest first. Read only: notes are written in the day panel. */
export function NotesPage() {
  const { data, isPending, isError, refetch } = useQuery(notesQuery);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="rounded-full" asChild>
          <Link to="/" aria-label="Back to calendar">
            <ArrowLeft />
          </Link>
        </Button>
        <span className="grid size-9 place-items-center rounded-xl bg-amber-400 text-amber-950 shadow-md shadow-amber-500/30">
          <NotebookPen className="size-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">Notes</h1>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && (
        <div role="alert" className="flex items-center gap-2 text-sm">
          Could not load notes.
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}
      {data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No notes yet. Add one from a day on the calendar.
        </p>
      )}

      {data && data.length > 0 && (
        <ol aria-label="Notes, newest first" className="space-y-3">
          {data.map((n) => (
            <li key={n.date}>
              <article
                aria-labelledby={`note-${n.date}`}
                className="space-y-2 rounded-2xl border-l-4 border-amber-400 bg-white p-4 shadow-sm ring-1 ring-violet-100 transition-shadow hover:shadow-md"
              >
                <h2 id={`note-${n.date}`} className="text-sm font-bold text-violet-800">
                  <Link
                    to="/calendar/$month"
                    params={{ month: n.date.slice(0, 7) }}
                    search={{ day: n.date }}
                    className="hover:underline"
                  >
                    <time dateTime={n.date}>
                      {DATE_WITH_YEAR.format(new Date(`${n.date}T00:00:00Z`))}
                    </time>
                  </Link>
                </h2>
                <p className="whitespace-pre-wrap break-words text-base leading-relaxed">
                  {n.note}
                </p>
              </article>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
