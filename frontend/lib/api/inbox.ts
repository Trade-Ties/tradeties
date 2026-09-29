import "server-only";

import { apiClient } from "./client";
import { APPOINTMENT_CONFLICTS } from "./failure";
import { answer, attempt, failureOf, type ApiFailure, type ApiResult } from "./problem";
import type { components } from "./schema";

/**
 * The tradesperson's side of the requests customers send.
 *
 * <p>Apart from `marketplace.ts`, which is the anonymous half of the same rows. Everything here
 * takes a token and resolves the business from it, so there is no id to pass and none to get
 * wrong.
 */

export type BusinessJobRequest = components["schemas"]["BusinessJobRequest"];
export type JobRequestStatus = components["schemas"]["JobRequestStatus"];
export type AppointmentInput = components["schemas"]["AppointmentInput"];
export type AppointmentChange = components["schemas"]["AppointmentChange"];
export type AppointmentConflict = components["schemas"]["AppointmentConflict"];
export type AppointmentResolution = components["schemas"]["AppointmentResolution"];

/**
 * `conflicts` is a refusal to render rather than a sentence to show: the accepted appointments in
 * the way, which the form puts to the tradesperson before sending the same body again.
 */
export type AppointmentOutcome =
  | { outcome: "saved"; request: BusinessJobRequest }
  | { outcome: "conflicts"; conflicts: AppointmentConflict[] }
  | { outcome: "failed"; failure: ApiFailure };

function isConflictList(body: unknown): body is { conflicts: AppointmentConflict[] } {
  if (typeof body !== "object" || body === null) return false;

  const candidate = body as { type?: unknown; conflicts?: unknown };
  return candidate.type === APPOINTMENT_CONFLICTS && Array.isArray(candidate.conflicts);
}

/** `answer` rather than `attempt`: a typed 409 carries the appointments in the way. */
async function settled(
  endpoint: string,
  call: () => Promise<{ data?: BusinessJobRequest; error?: unknown; response: Response }>,
): Promise<AppointmentOutcome> {
  const answered = await answer<BusinessJobRequest>(endpoint, call);

  if (!answered.reached) {
    return { outcome: "failed", failure: answered.failure };
  }

  const { data, error, response } = answered;

  if (response.ok) {
    return { outcome: "saved", request: data as BusinessJobRequest };
  }

  if (response.status === 409 && isConflictList(error)) {
    return { outcome: "conflicts", conflicts: error.conflicts };
  }

  return { outcome: "failed", failure: failureOf(endpoint, response, error) };
}

/**
 * Every request this business has had, soonest appointment first.
 *
 * **Wider than anything the customer side reads.** These carry a name, a telephone number and the
 * address the work is at — which is why this file is server-only and why nothing renders it
 * outside the dashboard.
 */
export function fetchMyJobRequests(
  accessToken: string,
  status?: JobRequestStatus,
): Promise<ApiResult<BusinessJobRequest[]>> {
  return attempt("GET /api/v1/me/business/job-requests", () =>
    apiClient(accessToken).GET("/api/v1/me/business/job-requests", {
      params: { query: status ? { status } : {} },
    }),
  );
}

/**
 * Takes the job at the hour it was asked for.
 *
 * A 409 is the one worth telling apart: the hour went while the page was open, and re-reading the
 * list is what answers it. A 422 means the request was already answered, and no retry reopens it.
 */
export function acceptJobRequest(
  accessToken: string,
  requestId: string,
): Promise<ApiResult<BusinessJobRequest>> {
  return attempt("POST /api/v1/me/business/job-requests/{requestId}/accept", () =>
    apiClient(accessToken).POST("/api/v1/me/business/job-requests/{requestId}/accept", {
      params: { path: { requestId } },
    }),
  );
}

export function declineJobRequest(
  accessToken: string,
  requestId: string,
  reason: string,
): Promise<ApiResult<BusinessJobRequest>> {
  return attempt("POST /api/v1/me/business/job-requests/{requestId}/decline", () =>
    apiClient(accessToken).POST("/api/v1/me/business/job-requests/{requestId}/decline", {
      params: { path: { requestId } },
      body: { reason },
    }),
  );
}

/** A customer booked in directly: accepted the moment it is written. */
export function bookAppointment(accessToken: string, body: AppointmentInput): Promise<AppointmentOutcome> {
  return settled("POST /api/v1/me/business/appointments", () =>
    apiClient(accessToken).POST("/api/v1/me/business/appointments", { body }),
  );
}

/** Any accepted appointment; a 422 for a request still waiting for an answer. */
export function changeAppointment(
  accessToken: string,
  requestId: string,
  body: AppointmentChange,
): Promise<AppointmentOutcome> {
  return settled("PUT /api/v1/me/business/appointments/{requestId}", () =>
    apiClient(accessToken).PUT("/api/v1/me/business/appointments/{requestId}", {
      params: { path: { requestId } },
      body,
    }),
  );
}

export function removeAppointment(accessToken: string, requestId: string): Promise<ApiResult<void>> {
  return attempt("DELETE /api/v1/me/business/appointments/{requestId}", () =>
    apiClient(accessToken).DELETE("/api/v1/me/business/appointments/{requestId}", {
      params: { path: { requestId } },
    }),
  );
}
