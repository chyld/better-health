import {
  type CellField,
  cellValue,
  type DaySummary,
  type HighlightColor,
} from "@better-health/shared";
import { cellTone, fieldKey, formatCellValue } from "@/features/profile/cellFields";
import { paletteTone } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { describeDay } from "./describe";

interface Props {
  day: DaySummary;
  /** What to show under the date, in order. */
  fields: readonly CellField[];
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
  fields,
  isToday,
  isFuture,
  isSelected,
  highlight,
  tabIndex,
  onSelect,
}: Props) {
  const tone = highlight && paletteTone[highlight.color];
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
        "group flex h-full min-h-16 w-full flex-col items-stretch gap-1 overflow-hidden rounded-xl bg-card p-1 text-left text-[10px] leading-tight tabular-nums shadow-xs ring-1 ring-violet-100 transition-all sm:rounded-2xl sm:p-1.5 sm:text-xs lg:min-h-20",
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
      <Values day={day} fields={fields} />
    </button>
  );
}

/**
 * The values the user chose on Profile, in their order, each after its caption. Days without a
 * value skip it. Phones and tablets stack them; desktops put two to a line. Phones and desktops
 * show short numbers (−1.2k), tablets show them in full.
 */
function Values({ day, fields }: { day: DaySummary; fields: readonly CellField[] }) {
  const rows = fields.flatMap((field) => {
    const value = cellValue(day, field);
    if (value === null) return [];
    return [{ field, value, ...formatCellValue(field.metric, value) }];
  });
  if (rows.length === 0) return null;
  return (
    <span className="flex flex-col gap-0.5 lg:grid lg:grid-cols-2 lg:gap-x-1" aria-hidden="true">
      {rows.map(({ field, value, compact, full }) => (
        <span
          key={field.id}
          data-value={fieldKey(field)}
          className={cn(
            // When a narrow cell has no room for both, the value wraps under its caption.
            "flex min-w-0 flex-wrap justify-between gap-x-0.5 rounded-md px-0.5 py-px font-semibold whitespace-nowrap sm:gap-x-1 sm:px-1",
            cellTone(field, value),
          )}
        >
          <span className="font-medium">{field.caption}</span>
          <span className="ml-auto">
            <span className="md:hidden lg:inline">{compact}</span>
            <span className="hidden md:inline lg:hidden">{full}</span>
          </span>
        </span>
      ))}
    </span>
  );
}
