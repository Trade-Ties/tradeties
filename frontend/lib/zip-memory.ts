/**
 * The visitor's ZIP code, remembered from the last time they gave one — in the hero search, on the
 * search results page, or in the open-slots section itself — so the landing page can show who is
 * free near them without asking again.
 *
 * A cookie rather than browser storage, because the server reads it: the open slots are searched
 * for while the page is rendered, not after it has loaded. A year, since where somebody lives
 * changes rarely, and it is theirs to change in one click. Nothing but the five digits is stored.
 */
export const ZIP_COOKIE = "tt_zip";

export function isZip(value: string | undefined): value is string {
  return value !== undefined && /^\d{5}$/.test(value);
}

/** Browser only. */
export function rememberZip(zip: string) {
  if (!isZip(zip)) return;
  document.cookie = `${ZIP_COOKIE}=${zip}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
