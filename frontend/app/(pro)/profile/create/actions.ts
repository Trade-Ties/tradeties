"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_PATH } from "@/lib/routes";
import * as api from "@/lib/api/business";
import type { ApiResult } from "@/lib/api/problem";
import { portalToken as token } from "@/lib/portal/session";

/**
 * The wizard's write path.
 *
 * The wizard is a client component and the API module is `server-only`, so these actions are
 * the only way the two meet, which is what keeps the access token out of client JavaScript.
 *
 * Every action authenticates itself. A server action is a POST endpoint like any other, and
 * having been rendered inside a guarded page proves nothing about who calls it later, so
 * `portalToken` — which redirects rather than returns when unsigned — is the guard rather than
 * a formality. Authorisation stays with the backend, which answers 403 to a caller without a
 * business role.
 *
 * Nothing is validated here: these take the wire shapes and pass them on. A 400 comes back as
 * an `ApiFailure` the form can render.
 */

/**
 * Busts the cached page that reads what the wizard just wrote.
 *
 * That is the dashboard, not the wizard. Every write endpoint here moves
 * `onboardingCompletedStep`, and the dashboard's card is what reads it back. The wizard holds
 * its form in component state and would throw a fresh render away.
 *
 * Asked for once per move, by the wizard, and never by the write actions themselves: a server
 * action that revalidates also makes Next re-render the route the caller is on and send it back
 * with the response — and that route is the wizard, whose loader fans out to eleven backend
 * reads plus the identity call. One bust per write would pay for that fan-out per request.
 *
 * `ProfileWizard.persist` calls this once, after everything a move writes has settled, and only
 * when something was actually sent. See `SaveOutcome.wrote`.
 */
export async function refreshDashboard(): Promise<void> {
  // Authenticated like every other action here: busting a signed-in person's cached page is
  // not something to hand an unauthenticated caller.
  await token();

  revalidatePath(DASHBOARD_PATH);
}

// --- Onboarding steps 1 and 2 ----------------------------------------------

export async function checkSlug(slug: string): Promise<ApiResult<api.SlugAvailability>> {
  return api.checkSlugAvailability(await token(), slug);
}

export async function createBusiness(
  body: api.CreateBusinessRequest,
): Promise<ApiResult<api.BusinessProfile>> {
  return api.createMyBusiness(await token(), body);
}

export async function updateBusiness(
  body: api.UpdateBusinessRequest,
): Promise<ApiResult<api.BusinessProfile>> {
  return api.updateMyBusiness(await token(), body);
}

/**
 * The stored profile, read again — asked for when a write of this client's was refused for a
 * reason that means what it holds is out of date. See `SLUG_LOCKED` in `save.ts`.
 *
 * Nothing to revalidate: a read changes nothing, so there is no cached page to bust.
 */
export async function loadBusiness(): Promise<ApiResult<api.BusinessProfile | null>> {
  return api.fetchMyBusiness(await token());
}

// --- Onboarding step 3 -----------------------------------------------------

export async function saveTrades(
  body: api.BusinessTradesRequest,
): Promise<ApiResult<api.BusinessTrades>> {
  return api.setMyTrades(await token(), body);
}

// --- Onboarding step 4 -----------------------------------------------------

export async function createService(body: api.ServiceInput): Promise<ApiResult<api.Service>> {
  return api.addMyService(await token(), body);
}

export async function updateService(
  serviceId: string,
  body: api.ServiceUpdate,
): Promise<ApiResult<api.Service>> {
  return api.replaceMyService(await token(), serviceId, body);
}

export async function deleteService(
  serviceId: string,
  unpublishConfirmed: boolean,
): Promise<ApiResult<void>> {
  return api.removeMyService(await token(), serviceId, unpublishConfirmed);
}

export async function reorderServices(serviceIds: string[]): Promise<ApiResult<api.Service[]>> {
  return api.reorderMyServices(await token(), { serviceIds });
}

// --- Onboarding step 5 -----------------------------------------------------

export async function savePricing(body: api.PricingInput): Promise<ApiResult<api.Pricing>> {
  return api.setMyPricing(await token(), body);
}

/**
 * The stored rates, read again — which the wizard only asks for after a write of its own was
 * refused for carrying a stale version. See `versionAfterConflict` in `save.ts`.
 *
 * Nothing to revalidate: a read changes nothing, so there is no cached page to bust.
 */
export async function loadPricing(): Promise<ApiResult<api.Pricing | null>> {
  return api.fetchMyPricing(await token());
}

// --- Onboarding step 6 -----------------------------------------------------

export async function createLicense(body: api.LicenseInput): Promise<ApiResult<api.License>> {
  return api.addMyLicense(await token(), body);
}

export async function updateLicense(
  licenseId: string,
  body: api.LicenseUpdate,
): Promise<ApiResult<api.License>> {
  return api.replaceMyLicense(await token(), licenseId, body);
}

export async function deleteLicense(licenseId: string): Promise<ApiResult<void>> {
  return api.removeMyLicense(await token(), licenseId);
}

// --- Onboarding steps 7 and 8 ----------------------------------------------

export async function saveWorkingHours(
  body: api.WorkingHours,
): Promise<ApiResult<api.WorkingHours>> {
  return api.setMyWorkingHours(await token(), body);
}

export async function saveBookingPolicy(
  body: api.BookingPolicyInput,
): Promise<ApiResult<api.BookingPolicy>> {
  return api.setMyBookingPolicy(await token(), body);
}

/** The booking rules, read again after a refused write. The counterpart of `loadPricing`. */
export async function loadBookingPolicy(): Promise<ApiResult<api.BookingPolicy | null>> {
  return api.fetchMyBookingPolicy(await token());
}

// --- Onboarding step 9 -----------------------------------------------------

export async function loadReadiness(): Promise<ApiResult<api.ProfileReadiness | null>> {
  return api.fetchMyReadiness(await token());
}

export async function publishProfile(): Promise<api.PublishOutcome> {
  const outcome = await api.publishMyBusiness(await token());

  if (outcome.outcome === "published") {
    revalidatePath(DASHBOARD_PATH);
  }

  return outcome;
}
