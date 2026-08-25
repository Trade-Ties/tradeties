import { digitsOnly } from "./digits";

/**
 * Everything this one field has agreed with the world, in one place.
 *
 * The three pieces below have to agree: what `format` produces must be what `toE164` can read,
 * and what `fromE164` produces must look like something `format` would have produced. A drift
 * between any two shows up as a saved number coming back wrong, silently.
 *
 * The formatting is not a wire difference to be removed. The contract wants E.164 because that
 * is what dedupes, what `tel:` links need and what SMS providers take; a person checking their
 * own business number wants `(303) 555-0101`, because that grouping is how a typo gets caught.
 */

/** The US country code, assumed rather than asked for — there is no field to state another. */
const US = "1";

/**
 * Whether a value states a country code of its own, and it is not the US one.
 *
 * A leading `+` is E.164 saying "the country code follows", so the digits behind it are not a
 * national number and must not be read as one. Without this test a stored `+4512345678` — a
 * Danish number, and a valid `^\+[1-9]\d{1,14}$` — has ten digits like any US one, so `format`
 * shows it as "(451) 234-5678" and `toE164` saves it as `+14512345678`, a different telephone.
 */
export function isInternational(value: string): boolean {
  const trimmed = value.trimStart();

  return trimmed.startsWith("+") && !trimmed.startsWith(`+${US}`);
}

/**
 * The ten national digits of a typed number, or null if it is not a US one.
 *
 * Eleven digits beginning with 1 are the same number with the country code already typed,
 * which is what a pasted `+1 (303) 555-0101` arrives as.
 */
export function nationalDigits(value: string): string | null {
  if (isInternational(value)) return null;

  const digits = digitsOnly(value);

  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith(US)) return digits.slice(1);

  return null;
}

/**
 * A number formatted as it is typed.
 *
 * No digit is ever dropped. Truncating would silently invent a different number — and eleven
 * digits is not an error, it is somebody pasting a number with its country code.
 */
export function format(raw: string): string {
  /**
   * A number carrying its own country code is left as the digits it states, behind the `+` it
   * states them behind. Not grouped: reading the first three as an area code shows a Danish
   * number as a US one.
   *
   * The separators it was pasted with do go. `+44 20 7946 0958` is the same telephone as
   * `+442079460958` and only the second is E.164, which is the whole of what `phoneProblem` asks
   * of an international number — so keeping the spaces would make a pasted number permanently
   * unacceptable to a field that has everything it needs to take it.
   */
  if (isInternational(raw)) return `+${digitsOnly(raw)}`;

  const digits = nationalDigits(raw) ?? digitsOnly(raw);

  if (digits.length === 0) return "";
  if (digits.length > 10) return raw;
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * A typed number as E.164, which is the only form the contract accepts.
 *
 * Anything that is not a US number goes over as its digits behind a `+` and is left to the
 * server to refuse. Guessing at a malformed number is how you come to store a wrong one.
 */
export function toE164(value: string): string {
  // An empty box goes over empty. A bare `+` is not a number at all, and it turns "phone is
  // required", which names the field, into a complaint about a value nobody typed.
  const digits = digitsOnly(value);
  if (digits === "") return "";

  // Not a US number — including one that arrived stating its own country code, which is why
  // `nationalDigits` refuses to read those as national. Its digits go over behind the `+` they
  // came with rather than behind this country's.
  const national = nationalDigits(value);

  return national === null ? `+${digits}` : `+${US}${national}`;
}

/**
 * E.164 back to the form's own formatting.
 *
 * Only a US number is unpacked, because only a US number can be re-entered in this field:
 * anything else is left as it arrived, where it is at least readable and round-trips through
 * `toE164` unchanged.
 */
export function fromE164(value: string): string {
  const match = /^\+1(\d{10})$/.exec(value);

  return match ? format(match[1]) : value;
}
