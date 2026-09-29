"use server";

import { addDays, format } from "date-fns";

import { getAvailability, getBusiness } from "@/lib/api/marketplace";

/**
 * What the booking popup reads about a real business, from the browser by way of the Next server
 * — the browser cannot reach `API_BASE_URL`. Sending the request itself is the booking page's
 * own action, `sendRequest`, so both ways of booking are refused and explained the same way.
 */

export type PopupService = { id: string; name: string };

/** The business's services, or null when it cannot be read or is no longer listed. */
export async function loadServices(slug: string): Promise<PopupService[] | null> {
  const found = await getBusiness(slug);
  if (!found.ok || !found.data) return null;
  return (found.data.services ?? []).map((service) => ({ id: service.id, name: service.name }));
}

/** How far ahead the popup's calendar reads: three pages of five days. */
const DAYS_AHEAD = 15;

/**
 * Every start of one service over the next fortnight, as instants to read in `timeZone`, or null
 * when they cannot be read. The backend clamps the window to the business's own notice and
 * horizon, so asking from today is always safe.
 */
export async function loadOpenings(
  slug: string,
  serviceId: string,
): Promise<{ timeZone: string; slots: string[] } | null> {
  const today = new Date();
  const found = await getAvailability(
    slug,
    serviceId,
    format(today, "yyyy-MM-dd"),
    format(addDays(today, DAYS_AHEAD - 1), "yyyy-MM-dd"),
  );
  if (!found.ok || !found.data) return null;
  return { timeZone: found.data.timeZone, slots: found.data.slots ?? [] };
}
