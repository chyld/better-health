import { calendarWeeks, type DaySummary, WEEKDAYS } from "@better-health/shared";
import { DayCell } from "./DayCell";

interface Props {
  month: string;
  days: DaySummary[];
  today: string;
  selected: string | undefined;
  onSelect: (date: string) => void;
}

export function MonthGrid({ month, days, today, selected, onSelect }: Props) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const weeks = calendarWeeks(month);
  // One cell is tabbable at a time: the selected day, else today, else the 1st.
  const focusDate =
    (selected && byDate.has(selected) && selected) || (byDate.has(today) ? today : days[0]?.date);

  return (
    <div role="grid" aria-label="Month" aria-readonly="true" className="flex flex-col gap-1">
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
