import { addDays, calendarWeeks, type DaySummary, WEEKDAYS } from "@better-health/shared";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { DayCell } from "./DayCell";

interface Props {
  month: string;
  days: DaySummary[];
  today: string;
  selected: string | undefined;
  onSelect: (date: string) => void;
  /** Keyboard movement; the target may be in another month. */
  onMove: (date: string) => void;
}

const MOVES: Record<string, (date: string) => string> = {
  ArrowLeft: (d) => addDays(d, -1),
  ArrowRight: (d) => addDays(d, 1),
  ArrowUp: (d) => addDays(d, -7),
  ArrowDown: (d) => addDays(d, 7),
  Home: (d) => addDays(d, -new Date(`${d}T00:00:00Z`).getUTCDay()),
  End: (d) => addDays(d, 6 - new Date(`${d}T00:00:00Z`).getUTCDay()),
};

export function MonthGrid({ month, days, today, selected, onSelect, onMove }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const keyboardMoved = useRef(false);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const weeks = calendarWeeks(month);
  // One cell is tabbable at a time: the selected day, else today, else the 1st.
  const focusDate =
    (selected && byDate.has(selected) && selected) || (byDate.has(today) ? today : days[0]?.date);

  // After a keyboard move, focus follows the selection, even into a new month.
  useEffect(() => {
    if (!keyboardMoved.current || !focusDate) return;
    keyboardMoved.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${focusDate}"]`)?.focus();
  }, [focusDate]);

  function onKeyDown(event: KeyboardEvent) {
    const move = MOVES[event.key];
    const from = (event.target as HTMLElement).dataset.date;
    if (!move || !from) return;
    event.preventDefault();
    keyboardMoved.current = true;
    onMove(move(from));
  }

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label="Month"
      aria-readonly="true"
      onKeyDown={onKeyDown}
      className="flex flex-col gap-1"
    >
      <div role="row" className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            role="columnheader"
            className="text-center text-xs font-medium text-muted-foreground"
          >
            <abbr title={d} className="no-underline">
              <span className="sm:hidden">{d[0]}</span>
              <span className="hidden sm:inline">{d}</span>
            </abbr>
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div role="row" key={week.find(Boolean)} className="grid grid-cols-7 gap-1">
          {week.map((date, i) => {
            const day = date ? byDate.get(date) : undefined;
            return (
              <div role="gridcell" key={date ?? `blank-${i}`} className="min-w-0">
                {day && (
                  <DayCell
                    day={day}
                    isToday={day.date === today}
                    isFuture={day.date > today}
                    isSelected={day.date === selected}
                    tabIndex={day.date === focusDate ? 0 : -1}
                    onSelect={onSelect}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
