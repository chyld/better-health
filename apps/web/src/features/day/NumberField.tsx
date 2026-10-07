import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import type { metricTone } from "@/lib/tones";
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
  /** Allows a decimal point on phone keypads. */
  decimal?: boolean;
  /** How a saved value reads in the field: 182.4 → "182.4" by default. */
  format?: (value: number) => string;
  suffix?: string;
  icon?: ReactNode;
  tone?: (typeof metricTone)[keyof typeof metricTone];
  onSave: (value: number | null) => void;
}

const toText = (v: number | null, format: (value: number) => string) =>
  v === null ? "" : format(v);

/** A number input that saves itself shortly after typing stops, and on blur. Empty clears. */
export function NumberField({
  label,
  value,
  schema,
  decimal = false,
  format = String,
  suffix,
  icon,
  tone,
  onSave,
}: Props) {
  const id = useId();
  const [text, setText] = useState(() => toText(value, format));
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
      setText(toText(value, format));
      setError(null);
    }
  }, [value, format]);

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
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl p-3 ring-1 lg:grid lg:grid-cols-[1fr_8rem] lg:items-center lg:gap-x-3 lg:gap-y-1 lg:p-2.5",
        tone ? tone.card : "bg-muted ring-border",
      )}
    >
      <Label htmlFor={id} className={cn("font-semibold", tone?.text)}>
        {icon && (
          <span
            className={cn("grid size-7 place-items-center rounded-lg [&_svg]:size-4", tone?.icon)}
          >
            {icon}
          </span>
        )}
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
            "h-14 border-white bg-white text-right text-2xl font-bold tabular-nums shadow-sm md:text-2xl lg:h-9 lg:text-sm",
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
