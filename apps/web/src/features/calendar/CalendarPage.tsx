import { shiftMonth } from "@better-health/shared";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DayPanel } from "@/features/day/DayPanel";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { longDate } from "./describe";
import { MonthGrid } from "./MonthGrid";
import { useMonth } from "./queries";

const MONTH_TITLE = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const calendarRoute = getRouteApi("/authed/calendar/$month");

export function CalendarPage() {
  const { month } = calendarRoute.useParams();
  const { day } = calendarRoute.useSearch();
  const today = calendarRoute.useRouteContext().today();
  const navigate = useNavigate({ from: "/calendar/$month" });
  const isDesktop = useIsDesktop();
  const { data, isPending, isError, refetch } = useMonth(month);

  // A selected day outside the shown month is ignored.
  const selected = day?.startsWith(month) ? day : undefined;
  const panelDate = selected ?? (isDesktop && today.startsWith(month) ? today : undefined);

  const select = (date: string | undefined) =>
    navigate({ search: date ? { day: date } : {}, replace: true });

  const title = MONTH_TITLE.format(new Date(`${month}-01T00:00:00Z`));

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <main className="flex min-w-0 flex-1 flex-col gap-3 p-2 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" asChild>
              <Link
                to="/calendar/$month"
                params={{ month: shiftMonth(month, -1) }}
                search={{}}
                aria-label="Previous month"
              >
                <ChevronLeft />
              </Link>
            </Button>
            <h1 className="min-w-36 text-center text-lg font-semibold" aria-live="polite">
              {title}
            </h1>
            <Button variant="outline" size="icon" asChild>
              <Link
                to="/calendar/$month"
                params={{ month: shiftMonth(month, 1) }}
                search={{}}
                aria-label="Next month"
              >
                <ChevronRight />
              </Link>
            </Button>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link
              to="/calendar/$month"
              params={{ month: today.slice(0, 7) }}
              search={{ day: today }}
            >
              Today
            </Link>
          </Button>
        </div>

        {isPending && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {isError && (
          <div role="alert" className="flex items-center gap-2 p-4 text-sm">
            Could not load this month.
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}
        {data && (
          <MonthGrid
            month={month}
            days={data.days}
            today={today}
            selected={selected}
            onSelect={select}
          />
        )}
      </main>

      {isDesktop ? (
        <aside className="w-full shrink-0 border-l lg:w-96" aria-label="Day details">
          {panelDate ? (
            <DayPanel key={panelDate} date={panelDate} />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Select a day.</p>
          )}
        </aside>
      ) : (
        <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && select(undefined)}>
          <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-xl">
            <SheetTitle className="px-4 pt-4 text-lg">
              {selected ? longDate(selected) : "Day"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Calories, weight, exercises and notes for this day
            </SheetDescription>
            {selected && <DayPanel key={selected} date={selected} heading={false} />}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
