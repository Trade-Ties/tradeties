import "server-only";

import { apiClient } from "./client";
import { answer, attempt, failureOf, type ApiFailure, type ApiResult } from "./problem";

import type {
  BookingPolicy,
  BookingPolicyInput,
  BusinessProfile,
  BusinessTrades,
  BusinessTradesRequest,
  CreateBusinessRequest,
  License,
  LicenseInput,
  LicenseUpdate,
  Pricing,
  PricingInput,
  ProfileReadiness,
  Service,
  ServiceInput,
  ServiceOrder,
  ServiceUpdate,
  SlugAvailability,
  Trade,
  UpdateBusinessRequest,
  UsState,
  UsTimeZone,
  WorkingHours,
} from "./wire";

/**
 * Server-only access to the caller's own business — onboarding steps 1 to 9.
 *
 * **Every function here takes the access token and nothing else.** No business id appears
 * anywhere, because the API has none to take: each path is `/api/v1/me/business/...` and the
 * server resolves the owner from the token. There is consequently no id for a client to swap
 * for someone else's, and nothing to authorise on this side of the wire.
 *
 * The browser never calls these: the wizard is a client component and the two meet in the
 * server actions under `app/(pro)/profile/create/actions.ts`.
 */

export type * from "./wire";

/**
 * Turns a 404 into `null` rather than into a failure.
 *
 * Several reads answer 404 as a normal statement about onboarding: the profile before step 2,
 * the rates before step 5, and everything hanging off a profile that does not exist yet. `null`
 * says "not there yet" and a failure says "something went wrong" — rendering the second as the
 * first invites a create that then collides with the business already stored.
 */
async function optional<T>(result: Promise<ApiResult<T>>): Promise<ApiResult<T | null>> {
  const settled = await result;

  if (!settled.ok && settled.failure.status === 404) {
    return { ok: true, data: null };
  }

  return settled;
}

// ---------------------------------------------------------------------------
// Reference data — the same lists the server validates against, which is the
// whole reason they are served rather than held in the client.
// ---------------------------------------------------------------------------

export function fetchTrades(accessToken: string): Promise<ApiResult<Trade[]>> {
  return attempt("GET /api/v1/trades", () => apiClient(accessToken).GET("/api/v1/trades"));
}

export function fetchUsStates(accessToken: string): Promise<ApiResult<UsState[]>> {
  return attempt("GET /api/v1/us-states", () => apiClient(accessToken).GET("/api/v1/us-states"));
}

export function fetchTimeZones(accessToken: string): Promise<ApiResult<UsTimeZone[]>> {
  return attempt("GET /api/v1/time-zones", () => apiClient(accessToken).GET("/api/v1/time-zones"));
}

// ---------------------------------------------------------------------------
// Onboarding steps 1 and 2 — the profile itself.
// ---------------------------------------------------------------------------

/** `null` means the caller has not got through step 2 yet, which is a normal state. */
export function fetchMyBusiness(accessToken: string): Promise<ApiResult<BusinessProfile | null>> {
  return optional(
    attempt("GET /api/v1/me/business", () => apiClient(accessToken).GET("/api/v1/me/business")),
  );
}

/** Steps 1 and 2 together — neither is persistable alone. A 409 means one already exists. */
export function createMyBusiness(
  accessToken: string,
  body: CreateBusinessRequest,
): Promise<ApiResult<BusinessProfile>> {
  return attempt("POST /api/v1/me/business", () =>
    apiClient(accessToken).POST("/api/v1/me/business", { body }),
  );
}

/**
 * Full replacement of steps 1 and 2, including the `version` last read.
 *
 * A 409 carrying `UNCONFIRMED_TIME_ZONE_CHANGE` is not a lost race: it asks whether moving
 * the calendar was intended. Resend the same body with `timeZoneChangeConfirmed: true`.
 */
export function updateMyBusiness(
  accessToken: string,
  body: UpdateBusinessRequest,
): Promise<ApiResult<BusinessProfile>> {
  return attempt("PUT /api/v1/me/business", () =>
    apiClient(accessToken).PUT("/api/v1/me/business", { body }),
  );
}

/** A `true` is not a reservation — the unique index decides, and the loser gets a 409. */
export function checkSlugAvailability(
  accessToken: string,
  slug: string,
): Promise<ApiResult<SlugAvailability>> {
  return attempt("GET /api/v1/me/business/slug-available", () =>
    apiClient(accessToken).GET("/api/v1/me/business/slug-available", {
      params: { query: { slug } },
    }),
  );
}

// ---------------------------------------------------------------------------
// Onboarding step 3 — trades.
// ---------------------------------------------------------------------------

export function fetchMyTrades(accessToken: string): Promise<ApiResult<BusinessTrades | null>> {
  return optional(
    attempt("GET /api/v1/me/business/trades", () =>
      apiClient(accessToken).GET("/api/v1/me/business/trades"),
    ),
  );
}

export function setMyTrades(
  accessToken: string,
  body: BusinessTradesRequest,
): Promise<ApiResult<BusinessTrades>> {
  return attempt("PUT /api/v1/me/business/trades", () =>
    apiClient(accessToken).PUT("/api/v1/me/business/trades", { body }),
  );
}

// ---------------------------------------------------------------------------
// Onboarding step 4 — services. Ordering is its own call rather than a field
// on each row.
// ---------------------------------------------------------------------------

export function fetchMyServices(accessToken: string): Promise<ApiResult<Service[] | null>> {
  return optional(
    attempt("GET /api/v1/me/business/services", () =>
      apiClient(accessToken).GET("/api/v1/me/business/services"),
    ),
  );
}

export function addMyService(accessToken: string, body: ServiceInput): Promise<ApiResult<Service>> {
  return attempt("POST /api/v1/me/business/services", () =>
    apiClient(accessToken).POST("/api/v1/me/business/services", { body }),
  );
}

export function replaceMyService(
  accessToken: string,
  serviceId: string,
  body: ServiceUpdate,
): Promise<ApiResult<Service>> {
  return attempt("PUT /api/v1/me/business/services/{serviceId}", () =>
    apiClient(accessToken).PUT("/api/v1/me/business/services/{serviceId}", {
      params: { path: { serviceId } },
      body,
    }),
  );
}

/**
 * 204, and possibly a deactivation rather than a delete where appointments point at it.
 *
 * `unpublishConfirmed` is the answer to "this takes your profile off the marketplace", which the
 * server asks by refusing with `UNCONFIRMED_UNPUBLISH` when the service being removed is the last
 * one a live profile has.
 */
export function removeMyService(
  accessToken: string,
  serviceId: string,
  unpublishConfirmed: boolean,
): Promise<ApiResult<void>> {
  return attempt("DELETE /api/v1/me/business/services/{serviceId}", () =>
    apiClient(accessToken).DELETE("/api/v1/me/business/services/{serviceId}", {
      params: { path: { serviceId }, query: { unpublishConfirmed } },
    }),
  );
}

/** Every active service exactly once. A partial list would reorder the rest by accident. */
export function reorderMyServices(
  accessToken: string,
  body: ServiceOrder,
): Promise<ApiResult<Service[]>> {
  return attempt("PUT /api/v1/me/business/services/order", () =>
    apiClient(accessToken).PUT("/api/v1/me/business/services/order", { body }),
  );
}

// ---------------------------------------------------------------------------
// Onboarding step 5 — rates and terms.
// ---------------------------------------------------------------------------

/** `null` until step 5 has been saved once: these rates have no defensible default. */
export function fetchMyPricing(accessToken: string): Promise<ApiResult<Pricing | null>> {
  return optional(
    attempt("GET /api/v1/me/business/pricing", () =>
      apiClient(accessToken).GET("/api/v1/me/business/pricing"),
    ),
  );
}

/** Omit `version` to say "nothing here yet", send it to replace. Either being wrong is 409. */
export function setMyPricing(
  accessToken: string,
  body: PricingInput,
): Promise<ApiResult<Pricing>> {
  return attempt("PUT /api/v1/me/business/pricing", () =>
    apiClient(accessToken).PUT("/api/v1/me/business/pricing", { body }),
  );
}

// ---------------------------------------------------------------------------
// Onboarding step 6 — licences. Optional, so an empty list is an answer and
// not a gap.
// ---------------------------------------------------------------------------

export function fetchMyLicenses(accessToken: string): Promise<ApiResult<License[] | null>> {
  return optional(
    attempt("GET /api/v1/me/business/licenses", () =>
      apiClient(accessToken).GET("/api/v1/me/business/licenses"),
    ),
  );
}

export function addMyLicense(accessToken: string, body: LicenseInput): Promise<ApiResult<License>> {
  return attempt("POST /api/v1/me/business/licenses", () =>
    apiClient(accessToken).POST("/api/v1/me/business/licenses", { body }),
  );
}

export function replaceMyLicense(
  accessToken: string,
  licenseId: string,
  body: LicenseUpdate,
): Promise<ApiResult<License>> {
  return attempt("PUT /api/v1/me/business/licenses/{licenseId}", () =>
    apiClient(accessToken).PUT("/api/v1/me/business/licenses/{licenseId}", {
      params: { path: { licenseId } },
      body,
    }),
  );
}

export function removeMyLicense(accessToken: string, licenseId: string): Promise<ApiResult<void>> {
  return attempt("DELETE /api/v1/me/business/licenses/{licenseId}", () =>
    apiClient(accessToken).DELETE("/api/v1/me/business/licenses/{licenseId}", {
      params: { path: { licenseId } },
    }),
  );
}

// ---------------------------------------------------------------------------
// Onboarding steps 7 and 8 — the calendar's own module.
// ---------------------------------------------------------------------------

/** Always seven days. A day with no blocks is closed, which is a statement, not a gap. */
export function fetchMyWorkingHours(accessToken: string): Promise<ApiResult<WorkingHours | null>> {
  return optional(
    attempt("GET /api/v1/me/business/working-hours", () =>
      apiClient(accessToken).GET("/api/v1/me/business/working-hours"),
    ),
  );
}

export function setMyWorkingHours(
  accessToken: string,
  body: WorkingHours,
): Promise<ApiResult<WorkingHours>> {
  return attempt("PUT /api/v1/me/business/working-hours", () =>
    apiClient(accessToken).PUT("/api/v1/me/business/working-hours", { body }),
  );
}

/**
 * Never 404 for an existing business: before the row is provisioned this answers with the
 * defaults at `version` 0, which is exactly what a first write would store.
 */
export function fetchMyBookingPolicy(
  accessToken: string,
): Promise<ApiResult<BookingPolicy | null>> {
  return optional(
    attempt("GET /api/v1/me/business/booking-policy", () =>
      apiClient(accessToken).GET("/api/v1/me/business/booking-policy"),
    ),
  );
}

export function setMyBookingPolicy(
  accessToken: string,
  body: BookingPolicyInput,
): Promise<ApiResult<BookingPolicy>> {
  return attempt("PUT /api/v1/me/business/booking-policy", () =>
    apiClient(accessToken).PUT("/api/v1/me/business/booking-policy", { body }),
  );
}

// ---------------------------------------------------------------------------
// Onboarding step 9 — publishing.
// ---------------------------------------------------------------------------

export function fetchMyReadiness(
  accessToken: string,
): Promise<ApiResult<ProfileReadiness | null>> {
  return optional(
    attempt("GET /api/v1/me/business/readiness", () =>
      apiClient(accessToken).GET("/api/v1/me/business/readiness"),
    ),
  );
}

/**
 * What publishing can answer.
 *
 * `not-ready` is a 422 and carries the same checklist the readiness endpoint serves, because
 * the conditions are re-evaluated in the transaction that sets the status — a service can be
 * deactivated between greying out the button and pressing it. It is deliberately not folded
 * into `failed`: the checklist is something to render, not a sentence to show.
 */
export type PublishOutcome =
  | { outcome: "published"; profile: BusinessProfile }
  | { outcome: "not-ready"; readiness: ProfileReadiness }
  | { outcome: "failed"; failure: ApiFailure };

/**
 * Whether a 422 body is the readiness checklist rather than a problem detail. Both fields are
 * tested because both are read: `ready` decides whether the checklist is shown, and `checks` is
 * iterated when it is.
 */
function isProfileReadiness(body: unknown): body is ProfileReadiness {
  if (typeof body !== "object" || body === null) return false;

  const candidate = body as Partial<ProfileReadiness>;

  return typeof candidate.ready === "boolean" && Array.isArray(candidate.checks);
}

export async function publishMyBusiness(accessToken: string): Promise<PublishOutcome> {
  const endpoint = "POST /api/v1/me/business/publish";

  // `answer` rather than `attempt`, because the refusal body is read here rather than
  // described: a 422 carries the checklist, which is something to render.
  const answered = await answer<BusinessProfile>(endpoint, () =>
    apiClient(accessToken).POST("/api/v1/me/business/publish"),
  );

  if (!answered.reached) {
    return { outcome: "failed", failure: answered.failure };
  }

  const { data, error, response } = answered;

  if (response.ok) {
    return { outcome: "published", profile: data as BusinessProfile };
  }

  // Only when the body is actually the checklist. 422 is the status the contract gives this
  // answer, but not one only this answer can carry: a validation layer or a gateway in front of
  // the application answers 422 with an RFC 9457 problem, and casting that to a checklist hands
  // the caller an object with no `checks` on it.
  if (response.status === 422 && isProfileReadiness(error)) {
    return { outcome: "not-ready", readiness: error };
  }

  return { outcome: "failed", failure: failureOf(endpoint, response, error) };
}
