import "server-only";

import {
  fetchMyBookingPolicy,
  fetchMyBusiness,
  fetchMyLicenses,
  fetchMyPricing,
  fetchMyReadiness,
  fetchMyServices,
  fetchMyTrades,
  fetchMyWorkingHours,
  fetchTimeZones,
  fetchTrades,
  fetchUsStates,
  type BookingPolicy,
  type BusinessProfile,
  type BusinessTrades,
  type License,
  type Pricing,
  type ProfileReadiness,
  type Service,
  type WorkingHours,
} from "./business";
import type { ApiFailure } from "./problem";
import type { ReferenceData } from "./reference";

export type { ReferenceData };

/**
 * The nullable members are the steps not reached yet, which is a different statement from a
 * read having failed — that case never produces a snapshot at all.
 */
export interface OnboardingSnapshot {
  profile: BusinessProfile;
  trades: BusinessTrades | null;
  services: Service[];
  pricing: Pricing | null;
  licenses: License[];
  workingHours: WorkingHours | null;
  bookingPolicy: BookingPolicy | null;
  readiness: ProfileReadiness | null;
}

/**
 * `not-started` confirms that no profile exists; `unavailable` means the backend could not
 * determine the state.
 *
 * Collapsing the two would hand a tradesperson an empty step 1 while their business sits in the
 * database, and the first save would come back 409 "one account, one business".
 */
export type OnboardingLoad =
  | { state: "not-started"; reference: ReferenceData }
  | { state: "resumable"; reference: ReferenceData; snapshot: OnboardingSnapshot }
  | { state: "unavailable"; failure: ApiFailure };

/**
 * Reads the profile and everything hanging off it.
 *
 * Two round trips rather than one: asking for services on a business that does not exist
 * would answer 404 seven times over.
 *
 * Any single failure fails the whole load. A partially read profile is worse than none: the
 * missing half would render as empty fields, and saving that step would then clear what is
 * stored, because every write in this API is a replacement rather than a merge.
 */
export async function loadOnboarding(accessToken: string): Promise<OnboardingLoad> {
  const [profile, trades, states, timeZones] = await Promise.all([
    fetchMyBusiness(accessToken),
    fetchTrades(accessToken),
    fetchUsStates(accessToken),
    fetchTimeZones(accessToken),
  ]);

  // One guard per read, and they cannot be folded into a loop: narrowing each result here is
  // what lets the snapshot below reach `.data` at all, so a read added without a guard fails to
  // compile rather than going out half-answered.
  if (!profile.ok) return { state: "unavailable", failure: profile.failure };
  if (!trades.ok) return { state: "unavailable", failure: trades.failure };
  if (!states.ok) return { state: "unavailable", failure: states.failure };
  if (!timeZones.ok) return { state: "unavailable", failure: timeZones.failure };

  const reference: ReferenceData = {
    trades: trades.data,
    states: states.data,
    timeZones: timeZones.data,
  };

  // `?? null` rather than a bare null check: a 2xx with an empty body reaches here as
  // `undefined`, and reading that as "a profile exists" hands the caller a snapshot with no
  // profile in it. `identity.ts` guards the same hazard the same way.
  const existing = profile.data ?? null;

  if (existing === null) {
    return { state: "not-started", reference };
  }

  const [businessTrades, services, pricing, licenses, workingHours, bookingPolicy, readiness] =
    await Promise.all([
      fetchMyTrades(accessToken),
      fetchMyServices(accessToken),
      fetchMyPricing(accessToken),
      fetchMyLicenses(accessToken),
      fetchMyWorkingHours(accessToken),
      fetchMyBookingPolicy(accessToken),
      fetchMyReadiness(accessToken),
    ]);

  // `readiness` is deliberately absent — see the note on it below.
  if (!businessTrades.ok) return { state: "unavailable", failure: businessTrades.failure };
  if (!services.ok) return { state: "unavailable", failure: services.failure };
  if (!pricing.ok) return { state: "unavailable", failure: pricing.failure };
  if (!licenses.ok) return { state: "unavailable", failure: licenses.failure };
  if (!workingHours.ok) return { state: "unavailable", failure: workingHours.failure };
  if (!bookingPolicy.ok) return { state: "unavailable", failure: bookingPolicy.failure };

  return {
    state: "resumable",
    reference,
    snapshot: {
      profile: existing,
      trades: businessTrades.data,
      // An empty list and "no entries yet" are the same thing to these two forms.
      services: services.data ?? [],
      licenses: licenses.data ?? [],
      pricing: pricing.data,
      workingHours: workingHours.data,
      bookingPolicy: bookingPolicy.data,
      // The one read the wizard opens without. Everything above is an answer the form is built
      // out of; the checklist only gates the last button, and without it the wizard lets the
      // publish be attempted and refused with the reason attached.
      readiness: readiness.ok ? readiness.data : null,
    },
  };
}
