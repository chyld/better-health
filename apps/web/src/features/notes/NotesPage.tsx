import type { DayNote } from "@better-health/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
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
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/" aria-label="Back to calendar">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Notes</h1>
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
        <ol aria-label="Notes, newest first" className="space-y-6">
          {data.map((n) => (
            <li key={n.date}>
              <article aria-labelledby={`note-${n.date}`} className="space-y-1.5">
                <h2 id={`note-${n.date}`} className="text-sm font-semibold">
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
