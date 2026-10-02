import { DAY_NOTE_MAX } from "@better-health/shared";
import { useEffect, useId, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

export function NoteField({
  value,
  onSave,
}: {
  value: string | null;
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
    <div className="space-y-2">
      <Label htmlFor={id}>Notes</Label>
      <Textarea
        id={id}
        value={text}
        maxLength={DAY_NOTE_MAX}
        rows={4}
        className="text-base lg:text-sm"
        placeholder="How did today go?"
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
