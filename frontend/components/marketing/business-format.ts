/**
 * How a real business is drawn, wherever it is drawn.
 *
 * Shared by the search results and the profile page rather than copied into each: the same
 * business must be the same two letters and the same colour on the card somebody clicked and on
 * the page they land on, or the two read as two companies.
 */

/**
 * The wire carries four decimal places because money is stored that way; nobody reads $85.0000.
 *
 * Two places or none, never one — "$149.5" is not a price.
 */
export function amount(wire: string): string {
  const value = Number(wire);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function money(wire: string): string {
  return `$${amount(wire)}`;
}

export function initialsOf(displayName: string): string {
  const words = displayName.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]!.toUpperCase()).join("");
}

/**
 * A colour per business, derived from the slug rather than stored.
 *
 * Deterministic on purpose: the same business is the same colour on every render and on both
 * sides of hydration, and a marketplace that has never asked anybody for a brand colour has none
 * to show.
 */
const AVATAR_COLORS = ["#1E4E82", "#0E9F6E", "#B4530A", "#0A2F5C", "#6D3FA8", "#B91C1C", "#CA8A04", "#C2410C"];

export function colorOf(slug: string): string {
  const sum = [...slug].reduce((total, character) => total + character.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]!;
}

/**
 * How long a service takes, in the words a customer uses for it.
 *
 * Minutes below the hour, hours above it, and never "90 minutes" for something everybody calls
 * an hour and a half. The number is the business's own estimate of what it reserves in the
 * calendar, which is not what gets billed — the terms say that.
 */
export function duration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const whole = `${hours} hr${hours === 1 ? "" : "s"}`;

  return rest === 0 ? whole : `${whole} ${rest} min`;
}
