/**
 * What may be typed into a box that takes a number, as its own leaf module: the two field
 * modules that want `digitsOnly` — `phone` and `postalCode` — are deliberately dependency-free.
 */

export const digitsOnly = (value: string) => value.replace(/\D/g, "");

/**
 * Amounts stay text all the way to the wire rather than being parsed per keystroke:
 * `Number("1.")` is `1`, so a field that round-trips through a number cannot have a decimal
 * point typed into it.
 */
export const decimalOnly = (value: string) => value.replace(/[^\d.]/g, "");
