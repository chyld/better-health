import { DAY_NOTE_MAX } from "@better-health/shared";
import { NotebookPen } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { metricTone } from "@/lib/tones";
import { cn } from "@/lib/utils";

export function NoteField({
  value,
  readOnly = false,
  onSave,
}: {
  value: string | null;
  readOnly?: boolean;
  onSave: (note: string | null) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value ?? "");
  const focused = useRef(false);
  const lastSent = useRef(value ?? "");
  const save = useDebouncedCallback((next: string) => {
    if (next === lastSent.current) return;
    lastSent.current = next;
    onSave(next.trim() ? next : null);
  }, 800);

  useEffect(() => {
    lastSent.current = value ?? "";
    if (!focused.current) setText(value ?? "");
  }, [value]);

  return (
    <div className={cn("space-y-2 rounded-2xl p-3 ring-1", metricTone.note.card)}>
      <Label htmlFor={id} className={cn("font-semibold", metricTone.note.text)}>
        <span
          className={cn(
            "grid size-7 place-items-center rounded-lg [&_svg]:size-4",
            metricTone.note.icon,
          )}
        >
          <NotebookPen aria-hidden="true" />
        </span>
        Notes
      </Label>
      <Textarea
        id={id}
        value={text}
        maxLength={DAY_NOTE_MAX}
        rows={4}
        readOnly={readOnly}
        className={cn(
          "border-white bg-white text-base shadow-sm lg:text-sm",
          readOnly && "bg-white/60 shadow-none",
        )}
        placeholder={readOnly ? "No note." : "How did today go?"}
        onChange={(e) => {
          setText(e.target.value);
          save.call(e.target.value);
        }}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          save.flush();
        }}
      />
    </div>
  );
}
