import { shiftMonth } from "@better-health/shared";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { type TouchEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DayPanel } from "@/features/day/DayPanel";
import { useHighlighter } from "@/features/profile/highlights";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { useShortcuts } from "@/hooks/useShortcuts";
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
  const highlightFor = useHighlighter();

  // A selected day outside the shown month is ignored.
  const selected = day?.startsWith(month) ? day : undefined;
  const panelDate = selected ?? (isDesktop && today.startsWith(month) ? today : undefined);

  const select = (date: string | undefined) =>
    navigate({ search: date ? { day: date } : {}, replace: true });
  const moveTo = (date: string) =>
    navigate({ params: { month: date.slice(0, 7) }, search: { day: date }, replace: true });
  const goMonth = (delta: number) =>
    navigate({ params: { month: shiftMonth(month, delta) }, search: {} });
  const goToday = () => navigate({ params: { month: today.slice(0, 7) }, search: { day: today } });

  const [addOpen, setAddOpen] = useState(false);
  // Close the add-exercise form whenever the shown day changes.
  useEffect(() => setAddOpen(false), [panelDate]);

  useShortcuts(isDesktop, {
    "[": () => goMonth(-1),
    "]": () => goMonth(1),
    t: goToday,
    e: () => panelDate && setAddOpen(true),
  });

  // Horizontal swipes on the grid change month on touch screens.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    const t = e.changedTouches[0];
    touchStart.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40) goMonth(dx < 0 ? 1 : -1);
  };

  const title = MONTH_TITLE.format(new Date(`${month}-01T00:00:00Z`));

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <main className="flex min-w-0 flex-1 flex-col gap-3 p-2 sm:gap-4 sm:p-4 lg:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="outline" size="icon" className="rounded-full" asChild>
              <Link
                to="/calendar/$month"
                params={{ month: shiftMonth(month, -1) }}
                search={{}}
                aria-label="Previous month"
              >
                <ChevronLeft />
              </Link>
            </Button>
            <h1
              className="min-w-40 text-center text-xl font-extrabold tracking-tight sm:min-w-52 sm:text-2xl"
              aria-live="polite"
            >
              {title}
            </h1>
            <Button variant="outline" size="icon" className="rounded-full" asChild>
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
          <Button size="sm" className="rounded-full px-4" asChild>
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
          <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} data-testid="swipe-area">
            <MonthGrid
              month={month}
              days={data.days}
              today={today}
              selected={selected}
              onSelect={select}
              highlightFor={highlightFor}
              onMove={moveTo}
            />
          </div>
        )}
        {isDesktop && (
          <p className="text-xs text-muted-foreground">
            Shortcuts: arrow keys move between days, <kbd>[</kbd> <kbd>]</kbd> change month,{" "}
            <kbd>t</kbd> today, <kbd>e</kbd> add exercise.
          </p>
        )}
      </main>

      {isDesktop ? (
        <aside
          className="w-full shrink-0 border-l border-violet-100 bg-white/70 backdrop-blur-sm lg:w-96"
          aria-label="Day details"
        >
          {panelDate ? (
            <DayPanel
              key={panelDate}
              date={panelDate}
              addExerciseOpen={addOpen}
              onAddExerciseOpenChange={setAddOpen}
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Select a day.</p>
          )}
        </aside>
      ) : (
        <>
          <Button
            size="icon"
            className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-xl shadow-fuchsia-500/40"
            aria-label="Log today"
            onClick={goToday}
          >
            <Plus className="size-6" />
          </Button>
          <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && select(undefined)}>
            <SheetContent
              side="bottom"
              className="h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl border-violet-100 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <SheetTitle className="px-4 pt-3 text-xl font-extrabold tracking-tight">
                {selected ? longDate(selected) : "Day"}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Calories, weight, exercises and notes for this day
              </SheetDescription>
              {selected && <DayPanel key={selected} date={selected} heading={false} />}
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
