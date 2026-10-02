import { longDate } from "@/features/calendar/describe";

/** `heading` is false inside the phone sheet, whose title already names the day. */
export function DayPanel({ date, heading = true }: { date: string; heading?: boolean }) {
  return (
    <section aria-label={`Details for ${longDate(date)}`} className="p-4">
      {heading && <h2 className="text-lg font-semibold">{longDate(date)}</h2>}
    </section>
  );
}
