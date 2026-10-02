import { type DaySummary, formatCompact, formatNumber, formatWeight } from "@better-health/shared";
import { cn } from "@/lib/utils";
import { describeDay } from "./describe";

interface Props {
  day: DaySummary;
  isToday: boolean;
  isFuture: boolean;
  isSelected: boolean;
  tabIndex: number;
  onSelect: (date: string) => void;
}

export function DayCell({ day, isToday, isFuture, isSelected, tabIndex, onSelect }: Props) {
  const dayNumber = Number(day.date.slice(8));
  return (
    <button
      type="button"
      data-date={day.date}
      tabIndex={tabIndex}
      aria-label={describeDay(day, { today: isToday })}
      data-future={isFuture || undefined}
      aria-current={isToday ? "date" : undefined}
      onClick={() => onSelect(day.date)}
      className={cn(
        "flex h-full min-h-20 w-full flex-col items-stretch gap-0.5 overflow-hidden rounded-md border bg-background p-1 text-left text-[10px] leading-tight tabular-nums transition-colors sm:min-h-24 sm:p-1.5 sm:text-xs lg:min-h-28",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isToday && "border-foreground border-2",
        isSelected && "bg-accent ring-2 ring-primary",
        // Dimmed with colour, not opacity, so text keeps enough contrast.
        isFuture && "border-dashed text-muted-foreground",
      )}
    >
      <span className="flex items-center justify-between">
        <span className={cn("text-xs font-semibold sm:text-sm", isToday && "underline")}>
          {dayNumber}
        </span>
        <span className="flex gap-0.5" aria-hidden="true">
          {day.hasNote && (
            <span className="size-1.5 rounded-full border border-foreground" title="Note" />
          )}
        </span>
      </span>
      <Values day={day} />
    </button>
  );
}

/** Net calories, number of exercises and weight: the same three rows on every screen. */
function Values({ day }: { day: DaySummary }) {
  const rows: { key: string; short: string; long: string; compact: string; full: string }[] = [];
  if (day.net !== null) {
    rows.push({
      key: "net",
      short: "Net",
      long: "Net",
      compact: formatCompact(day.net, { signed: true }),
      full: formatNumber(day.net, { signed: true }),
    });
  }
  if (day.exerciseCount > 0) {
    const n = String(day.exerciseCount);
    rows.push({ key: "exercise", short: "Ex", long: "Exercise", compact: n, full: n });
  }
  if (day.weightLbs !== null) {
    const w = formatWeight(day.weightLbs);
    rows.push({ key: "weight", short: "lb", long: "Weight", compact: w, full: w });
  }
  return (
    <span className="flex flex-col" aria-hidden="true">
      {rows.map((r) => (
        <span
          key={r.key}
          data-value={r.key}
          className="flex justify-between gap-1 whitespace-nowrap"
        >
          <span className="text-muted-foreground">
            <span className="md:hidden">{r.short}</span>
            <span className="hidden md:inline">{r.long}</span>
          </span>
          <span>
            <span className="md:hidden">{r.compact}</span>
            <span className="hidden md:inline">{r.full}</span>
          </span>
        </span>
      ))}
    </span>
  );
}
