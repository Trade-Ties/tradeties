import { digitsOnly } from "./digits";

/**
 * Everything this one field has agreed with the world, in one place.
 *
 * The counterpart of `phone.ts`, for the same reason: the typing format and the rule it has to
 * satisfy are one statement, and relaxing either on its own — accepting a pasted ZIP+4 with a
 * space, letting the dash be typed — makes the box format a value the checker calls invalid.
 *
 * There is no wire conversion to keep in step as well: a postal code goes over as it is typed,
 * trimmed, so the shape below is the whole of it.
 */

/** The contract's own `^\d{5}(-\d{4})?$`, read by both halves of this file. */
const SHAPE = /^\d{5}(-\d{4})?$/;

/** Five digits, or nine with the dash the format puts in — what `SHAPE` accepts, as a length. */
const ZIP = 5;
const ZIP_PLUS_FOUR = 9;

/** A code formatted as it is typed, with the dash inserted rather than keyed. */
export function format(raw: string): string {
  const digits = digitsOnly(raw).slice(0, ZIP_PLUS_FOUR);

  if (digits.length <= ZIP) return digits;

  return `${digits.slice(0, ZIP)}-${digits.slice(ZIP)}`;
}

export function isComplete(value: string): boolean {
  return SHAPE.test(value.trim());
}
