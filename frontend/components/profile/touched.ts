"use client";

import { useState } from "react";

import type { FieldProblem } from "./validate";

/**
 * Which fields have been left, so a complaint about the format waits until somebody has finished
 * typing it. A ZIP code is three digits on the way to five: the wrong shape, and not a mistake.
 *
 * Keyed by a name the caller chooses rather than by the control, because these marks are spread
 * over the two components that edit one slice of the form.
 */
export function useTouched() {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  return {
    /** The `onBlur` for the field called `name`. */
    touch: (name: string) => () => setTouched((seen) => ({ ...seen, [name]: true })),
    /** The problem, once that field has been left behind — and nothing at all before then. */
    settled: (name: string, problem: FieldProblem): FieldProblem =>
      touched[name] ? problem : undefined,
  };
}
