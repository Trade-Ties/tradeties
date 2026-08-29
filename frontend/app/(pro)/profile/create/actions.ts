"use server";

import { revalidatePath } from "next/cache";

import * as api from "@/lib/api/business";
import type { ApiResult } from "@/lib/api/problem";
import { portalToken as token } from "@/lib/portal/session";
import { PROFILE_PATH } from "@/lib/routes";

/**
 * Every action here must authenticate itself. A server action is a POST endpoint like any other,
 * and having been rendered inside a guarded page says nothing about who calls it later, so
 * `portalToken` — which redirects rather than returns when unsigned — is the guard on each one.
 */

/**
 * Called once per move by `ProfileWizard.persist`, never by the write actions themselves: a
 * server action that revalidates makes Next re-render the route the caller is on — the wizard,
 * whose loader fans out to eleven backend reads plus the identity call. One bust per write would
 * pay for that fan-out per request. See `SaveOutcome.wrote`.
 */
export async function refreshProfileOverview(): Promise<void> {
  // The result is unused; the call is the guard, and it redirects an unsigned caller.
  await token();

  revalidatePath(PROFILE_PATH);
}

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

export async function loadBusiness(): Promise<ApiResult<api.BusinessProfile | null>> {
  return api.fetchMyBusiness(await token());
}

export async function saveTrades(
  body: api.BusinessTradesRequest,
): Promise<ApiResult<api.BusinessTrades>> {
  return api.setMyTrades(await token(), body);
}

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

export async function savePricing(body: api.PricingInput): Promise<ApiResult<api.Pricing>> {
  return api.setMyPricing(await token(), body);
}

export async function loadPricing(): Promise<ApiResult<api.Pricing | null>> {
  return api.fetchMyPricing(await token());
}

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

export async function loadBookingPolicy(): Promise<ApiResult<api.BookingPolicy | null>> {
  return api.fetchMyBookingPolicy(await token());
}

export async function loadReadiness(): Promise<ApiResult<api.ProfileReadiness | null>> {
  return api.fetchMyReadiness(await token());
}

export async function publishProfile(): Promise<api.PublishOutcome> {
  const outcome = await api.publishMyBusiness(await token());

  if (outcome.outcome === "published") {
    revalidatePath(PROFILE_PATH);
  }

  return outcome;
}
