import "server-only";

import { apiClient } from "./client";
import { attempt, type ApiResult } from "./problem";
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
