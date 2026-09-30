"use server";

import { addDays, format } from "date-fns";

import { DIALOG_CALENDAR_WEEKS } from "@/components/marketing/availability";
import { getAvailability, getBusiness, listUsStates, type PublicBusinessProfile } from "@/lib/api/marketplace";

/**
 * What the popups read about a real business — the booking dialogue and the overview a card's name
 * opens — from the browser by way of the Next server, since the browser cannot reach
 * `API_BASE_URL`. Sending the request itself is the booking page's own action, `sendRequest`, so
 * both ways of booking are refused and explained the same way.
 */

export type PopupService = { id: string; name: string };

/** The business's services, or null when it cannot be read or is no longer listed. */
export async function loadServices(slug: string): Promise<PopupService[] | null> {
  const found = await getBusiness(slug);
  if (!found.ok || !found.data) return null;
  return (found.data.services ?? []).map((service) => ({ id: service.id, name: service.name }));
}

/**
 * The states a service address can be in, as the options the dropdown shows: the name to read and
 * type at, the code the request carries. Null when the list cannot be read.
 */
export async function loadStates(): Promise<{ value: string; label: string }[] | null> {
  const found = await listUsStates();
  return found.ok ? found.data.map((state) => ({ value: state.code, label: state.name })) : null;
}

/** The whole public profile, or null when it cannot be read or is no longer listed. */
export async function loadProfile(slug: string): Promise<PublicBusinessProfile | null> {
  const found = await getBusiness(slug);
  return found.ok ? found.data : null;
}

/**
 * Every start of one service over the popup calendar's weeks, as instants to read in `timeZone`,
 * or null when they cannot be read. The backend clamps the window to the business's own notice and
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
    // The last week's Saturday is at most this far off, whichever weekday today is — one day more
    // than the weeks hold, because the business's today can already be this server's tomorrow.
    format(addDays(today, DIALOG_CALENDAR_WEEKS * 7), "yyyy-MM-dd"),
  );
  if (!found.ok || !found.data) return null;
  return { timeZone: found.data.timeZone, slots: found.data.slots ?? [] };
}
