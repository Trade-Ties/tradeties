"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { CONTROL_HEIGHT, Field, SelectControl, useFieldIds } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import { digitsOnly } from "./digits";

/** The option that opens the box; never a value that is stored. */
const CUSTOM = -1;

/**
 * A dropdown of the usual answers with "Custom…" at the end, which opens a number box beside it for
 * any other whole figure.
 *
 * <p>A stored value that is none of the presets — a 2 from before the list changed, or a figure
 * typed earlier — opens on "Custom…" with that figure in the box, rather than on a dropdown showing
 * nothing.
 *
 * <p>The box holds its own text, so it can be empty while a figure is retyped; only a figure is ever
 * handed on, at most `max`, and leaving the box empty puts back the last one.
 */
export function PresetOrCustomField({
  label,
  hint,
  unit,
  max,
  presets,
  format,
  value,
  onValueChange,
}: {
  label: string;
  hint: string;
  /** Shown inside the box, and in its accessible name: "hours", "minutes". */
  unit: string;
  max: number;
  /** Must be a stable array: the dropdown cuts its options once per list. */
  presets: readonly number[];
  format: (value: number) => string;
  value: number;
  onValueChange: (value: number) => void;
}) {
  const { controlId, messageId, describedBy } = useFieldIds(true);
  const [custom, setCustom] = useState(() => !presets.includes(value));
  const [draft, setDraft] = useState(String(value));
  // Only a "Custom…" just picked takes the cursor; one the page opened on leaves it where it is.
  const [picked, setPicked] = useState(false);

  const options = useMemo(
    () => [...presets.map((preset) => ({ value: preset, label: format(preset) })), { value: CUSTOM, label: "Custom…" }],
    [presets, format]
  );

  return (
    <Field label={label} required htmlFor={controlId} messageId={messageId} hint={hint}>
      <div className="flex gap-2">
        <SelectControl
          id={controlId}
          aria-describedby={describedBy}
          aria-required
          options={options}
          value={custom ? CUSTOM : value}
          onValueChange={(next) => {
            if (next === CUSTOM) {
              setCustom(true);
              setPicked(true);
              setDraft(String(value));
              return;
            }
            setCustom(false);
            onValueChange(next);
          }}
          className="min-w-0 flex-1"
        />
        {custom && (
          <div className="relative w-32 shrink-0">
            <Input
              inputMode="numeric"
              autoFocus={picked}
              aria-label={`${label}, in ${unit}`}
              value={draft}
              onChange={(e) => {
                const digits = digitsOnly(e.target.value);
                // The ceiling is safe per keystroke — it only ever shortens what is there.
                const capped = digits === "" ? "" : String(Math.min(max, Number(digits)));
                setDraft(capped);
                if (capped !== "") onValueChange(Number(capped));
              }}
              onBlur={() => {
                if (draft === "") setDraft(String(value));
              }}
              className={cn(CONTROL_HEIGHT, "pr-16")}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
              {unit}
            </span>
          </div>
        )}
      </div>
    </Field>
  );
}
