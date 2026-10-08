import { PALETTE_COLORS, type PaletteColor } from "@better-health/shared";
import { Check } from "lucide-react";
import { paletteTone } from "@/lib/palette";
import { cn } from "@/lib/utils";

const SWATCH =
  "grid size-8 cursor-pointer place-items-center rounded-lg ring-2 ring-transparent transition-transform has-[:checked]:scale-110 has-[:checked]:ring-violet-700 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring sm:size-9";

/**
 * The 32 palette colours as radio buttons, soft tints in the top two rows and bold shades below.
 * `swatch` shows each one as a value's pill or as a highlighted cell. With `automatic`, a first
 * choice keeps the value's own colours (null).
 */
export function ColorGrid({
  name,
  legend,
  value,
  onChange,
  swatch,
  automatic = false,
}: {
  name: string;
  legend: string;
  value: PaletteColor | null;
  onChange: (color: PaletteColor | null) => void;
  swatch: "pill" | "cell";
  automatic?: boolean;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium">{legend}</legend>
      {automatic && (
        <label
          className={cn(
            SWATCH,
            "w-auto gap-1.5 bg-slate-100 px-3 text-xs font-semibold text-slate-700 sm:w-auto",
            "flex",
          )}
        >
          <input
            type="radio"
            name={name}
            checked={value === null}
            onChange={() => onChange(null)}
            className="sr-only"
          />
          {value === null && <Check aria-hidden="true" className="size-4" />}
          Automatic
        </label>
      )}
      <div className="grid w-fit grid-cols-8 gap-1.5">
        {PALETTE_COLORS.map((c) => {
          const tone = paletteTone[c];
          return (
            <label
              key={c}
              title={tone.name}
              className={cn(
                SWATCH,
                swatch === "pill" ? tone.pill : cn(tone.cell, "text-slate-900"),
              )}
            >
              <input
                type="radio"
                name={name}
                value={c}
                checked={value === c}
                onChange={() => onChange(c)}
                className="sr-only"
              />
              <span className="sr-only">{tone.name}</span>
              {value === c && <Check aria-hidden="true" className="size-4" />}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
