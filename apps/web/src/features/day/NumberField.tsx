import { useEffect, useId, useRef, useState } from "react";
import type { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

interface Props {
  label: string;
  value: number | null;
  schema: z.ZodType<number>;
  decimal?: boolean;
  suffix?: string;
  onSave: (value: number | null) => void;
}

const toText = (v: number | null, decimal: boolean) =>
  v === null ? "" : decimal ? v.toFixed(1) : String(v);

/** A number input that saves itself shortly after typing stops, and on blur. Empty clears. */
export function NumberField({ label, value, schema, decimal = false, suffix, onSave }: Props) {
  const id = useId();
  const [text, setText] = useState(() => toText(value, decimal));
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);
  const lastSent = useRef(value);
  const save = useDebouncedCallback((next: number | null) => {
    if (next === lastSent.current) return;
    lastSent.current = next;
    onSave(next);
  }, 800);

  // Follow the server unless the user is mid-edit.
  useEffect(() => {
    lastSent.current = value;
    if (!focused.current) {
      setText(toText(value, decimal));
      setError(null);
    }
  }, [value, decimal]);

  function change(raw: string) {
    setText(raw);
    const trimmed = raw.trim();
    if (trimmed === "") {
      setError(null);
      save.call(null);
      return;
    }
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      setError("Enter a number");
      save.cancel();
      return;
    }
    const result = schema.safeParse(Number(trimmed));
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid");
      save.cancel();
      return;
    }
    setError(null);
    save.call(result.data);
  }

  return (
    <div className="grid grid-cols-[1fr_8rem] items-center gap-x-3 gap-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          inputMode={decimal ? "decimal" : "numeric"}
          autoComplete="off"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => change(e.target.value)}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            save.flush();
          }}
          className={suffix ? "pr-10 text-right tabular-nums" : "text-right tabular-nums"}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="col-span-2 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
