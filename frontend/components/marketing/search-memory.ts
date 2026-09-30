import { useSyncExternalStore } from "react";

/**
 * What the visitor has typed into the hero search bar, kept while they look at the results and
 * come back through "Back to search".
 *
 * A module variable rather than `sessionStorage`, because a reload or a closed tab should start
 * over and `sessionStorage` survives the reload. Every "Back to search" is a client-side
 * navigation, which keeps the module and with it this search. A sent booking request forgets it:
 * the job it described has been asked for.
 *
 * Browser only. On the server the module is shared by every request, so nothing may write it
 * there — the components that do, do it from event handlers.
 */

export type WhenMode = "today" | "tomorrow" | "flexible" | "custom";

export type HeroSearchFields = {
  job: string;
  /**
   * The catalogue job behind what is in the box, when the customer picked one rather than typing
   * their own words. Sent alongside the text so the search narrows by the job itself instead of
   * reading a trade out of prose — which is where "Toilet is leaking" used to reach roofers.
   */
  service: string | null;
  zip: string;
  whenMode: WhenMode;
  customDate: Date | undefined;
};

const BLANK: HeroSearchFields = { job: "", service: null, zip: "", whenMode: "today", customDate: undefined };

let remembered = BLANK;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRememberedSearch(): HeroSearchFields {
  return useSyncExternalStore(
    subscribe,
    () => remembered,
    () => BLANK,
  );
}

export function updateSearch(changes: Partial<HeroSearchFields>) {
  remembered = { ...remembered, ...changes };
  listeners.forEach((listener) => listener());
}

export function forgetSearch() {
  updateSearch(BLANK);
}
