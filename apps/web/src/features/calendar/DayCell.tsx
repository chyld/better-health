import {
  type DaySummary,
  formatCompact,
  formatNumber,
  formatWeight,
  type HighlightColor,
} from "@better-health/shared";
import { highlightTone, metricTone, netTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { describeDay } from "./describe";

interface Props {
  day: DaySummary;
  isToday: boolean;
  isFuture: boolean;
  isSelected: boolean;
  /** The highlight rule this day meets, if any. */
  highlight?: { color: HighlightColor; text: string };
  tabIndex: number;
  onSelect: (date: string) => void;
}

export function DayCell({
  day,
  isToday,
  isFuture,
  isSelected,
  highlight,
  tabIndex,
  onSelect,
}: Props) {
  const tone = highlight && highlightTone[highlight.color];
  const dayNumber = Number(day.date.slice(8));
  return (
    <button
      type="button"
      data-date={day.date}
      tabIndex={tabIndex}
      aria-label={describeDay(day, { today: isToday, highlight: highlight?.text })}
      data-highlight={highlight?.color}
      data-future={isFuture || undefined}
      aria-current={isToday ? "date" : undefined}
      onClick={() => onSelect(day.date)}
      className={cn(
        "group flex h-full min-h-20 w-full flex-col items-stretch gap-1 overflow-hidden rounded-xl bg-card p-1 text-left text-[10px] leading-tight tabular-nums shadow-xs ring-1 ring-violet-100 transition-all sm:min-h-24 sm:rounded-2xl sm:p-1.5 sm:text-xs lg:min-h-28",
        "hover:shadow-md hover:ring-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:hover:-translate-y-0.5",
        tone?.ring,
        isSelected && "bg-violet-50 shadow-md ring-2 ring-violet-500 hover:ring-violet-500",
        // Dimmed with colour, not opacity, so text keeps enough contrast.
        isFuture &&
          "bg-white/50 text-muted-foreground border border-dashed border-violet-200 shadow-none ring-0",
        tone?.cell,
      )}
    >
      <span className="flex items-center justify-between">
        <span
          className={cn(
            "grid size-5 place-items-center rounded-full text-xs font-bold sm:size-6 sm:text-sm",
            isToday && "brand-gradient text-white shadow-sm shadow-fuchsia-500/40",
          )}
        >
          {dayNumber}
        </span>
        <span className="flex gap-0.5" aria-hidden="true">
          {day.hasNote && (
            <span className="size-2 rounded-full bg-amber-400 ring-2 ring-amber-100" title="Note" />
          )}
        </span>
      </span>
      <Values day={day} />
    </button>
  );
}

/** Net calories, number of exercises and weight: the same three rows on every screen. */
function Values({ day }: { day: DaySummary }) {
  const rows: {
    key: string;
    short: string;
    long: string;
    compact: string;
    full: string;
    tone: string;
  }[] = [];
  if (day.net !== null) {
    rows.push({
      key: "net",
      // Phone cells are ~47px wide; the sign on the value already says "net".
      short: "N",
      long: "Net",
      compact: formatCompact(day.net, { signed: true }),
      full: formatNumber(day.net, { signed: true }),
      tone: netTone(day.net).pill,
    });
  }
  if (day.exerciseCount > 0) {
    const n = String(day.exerciseCount);
    rows.push({
      key: "exercise",
      short: "Ex",
      long: "Exercise",
      compact: n,
      full: n,
      tone: `${metricTone.exercise.card} ${metricTone.exercise.text}`,
    });
  }
  if (day.weightLbs !== null) {
    const w = formatWeight(day.weightLbs);
    rows.push({
      key: "weight",
      short: "lb",
      long: "Weight",
      compact: w,
      full: w,
      tone: `${metricTone.weight.card} ${metricTone.weight.text}`,
    });
  }
  return (
    <span className="flex flex-col gap-0.5" aria-hidden="true">
      {rows.map((r) => (
        <span
          key={r.key}
          data-value={r.key}
          className={cn(
            "flex justify-between gap-0.5 rounded-md px-0.5 py-px font-semibold whitespace-nowrap sm:gap-1 sm:px-1.5 sm:py-0.5",
            r.tone,
          )}
        >
          <span className="font-medium">
            <span className="md:hidden">{r.short}</span>
            <span className="hidden md:inline">{r.long}</span>
          </span>
          <span className="shrink-0">
            <span className="md:hidden">{r.compact}</span>
            <span className="hidden md:inline">{r.full}</span>
          </span>
        </span>
      ))}
    </span>
  );
}
