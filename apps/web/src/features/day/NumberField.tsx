import { useEffect, useId, useRef, useState } from "react";
import type { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { cn } from "@/lib/utils";

/** Enter on a phone keypad jumps to the next field in the panel instead of doing nothing. */
export function focusNextField(from: HTMLElement) {
  const scope = from.closest("section") ?? document;
  const fields = [...scope.querySelectorAll<HTMLElement>("input, textarea")];
  const next = fields[fields.indexOf(from) + 1];
  if (next) next.focus();
  else from.blur();
}

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
    <div className="flex flex-col gap-1.5 lg:grid lg:grid-cols-[1fr_8rem] lg:items-center lg:gap-x-3 lg:gap-y-1">
      <Label htmlFor={id} className="text-muted-foreground lg:text-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode={decimal ? "decimal" : "numeric"}
          enterKeyHint="next"
          autoComplete="off"
          value={text}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              focusNextField(e.currentTarget);
            }
          }}
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
          className={cn(
            "h-14 text-right text-2xl tabular-nums md:text-2xl lg:h-9 lg:text-sm",
            suffix && "pr-14 lg:pr-10",
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base text-muted-foreground lg:right-3 lg:text-xs">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="text-sm text-destructive lg:col-span-2 lg:text-right lg:text-xs"
        >
          {error}
        </p>
      )}
    </div>
  );
}
