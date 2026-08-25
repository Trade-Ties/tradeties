/**
 * Its own leaf module rather than a line in `constants.ts`, because the two field modules that
 * want it — `phone` and `postalCode` — are deliberately dependency-free, and `constants` pulls
 * in the icon set and the field kit behind it.
 */
export const digitsOnly = (value: string) => value.replace(/\D/g, "");
