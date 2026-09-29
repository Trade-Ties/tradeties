import "server-only";

import { apiClient } from "./client";
import { TIME_OFF_CONFLICTS } from "./failure";
import { answer, attempt, failureOf, type ApiFailure, type ApiResult } from "./problem";
import type { components } from "./schema";

/**
 * The tradesperson's time off and blocked hours — the calendar module's own writes beside the
 * working week in `business.ts`.
 */

export type TimeOff = components["schemas"]["TimeOff"];
export type TimeOffInput = components["schemas"]["TimeOffInput"];
export type TimeOffConflict = components["schemas"]["TimeOffConflict"];

/** Entries not over yet, soonest first. */
export function fetchMyTimeOff(accessToken: string): Promise<ApiResult<TimeOff[]>> {
  return attempt("GET /api/v1/me/business/time-off", () =>
    apiClient(accessToken).GET("/api/v1/me/business/time-off"),
  );
}

/**
 * `conflicts` is a refusal to render rather than a sentence to show: the requests the entry would
 * cover, which the dialog puts to the tradesperson before sending the same body again.
 */
export type TimeOffOutcome =
  | { outcome: "saved"; timeOff: TimeOff }
  | { outcome: "conflicts"; conflicts: TimeOffConflict[] }
  | { outcome: "failed"; failure: ApiFailure };

function isConflictList(body: unknown): body is { conflicts: TimeOffConflict[] } {
  if (typeof body !== "object" || body === null) return false;

  const candidate = body as { type?: unknown; conflicts?: unknown };
  return candidate.type === TIME_OFF_CONFLICTS && Array.isArray(candidate.conflicts);
}

/** Adds an entry, or replaces the one named by `existing`. */
export async function saveMyTimeOff(
  accessToken: string,
  body: TimeOffInput,
  existing?: { id: string; version: number },
): Promise<TimeOffOutcome> {
  const endpoint = existing
    ? "PUT /api/v1/me/business/time-off/{timeOffId}"
    : "POST /api/v1/me/business/time-off";

  // `answer` rather than `attempt`: a 409 carries the list of requests in the way.
  const answered = await answer<TimeOff>(endpoint, () =>
    existing
      ? apiClient(accessToken).PUT("/api/v1/me/business/time-off/{timeOffId}", {
          params: { path: { timeOffId: existing.id } },
          body: { ...body, version: existing.version },
        })
      : apiClient(accessToken).POST("/api/v1/me/business/time-off", { body }),
  );

  if (!answered.reached) {
    return { outcome: "failed", failure: answered.failure };
  }

  const { data, error, response } = answered;

  if (response.ok) {
    return { outcome: "saved", timeOff: data as TimeOff };
  }

  // Only when the body is the typed list. An untyped 409 on a replace is a stale version.
  if (response.status === 409 && isConflictList(error)) {
    return { outcome: "conflicts", conflicts: error.conflicts };
  }

  return { outcome: "failed", failure: failureOf(endpoint, response, error) };
}

export function removeMyTimeOff(accessToken: string, timeOffId: string): Promise<ApiResult<void>> {
  return attempt("DELETE /api/v1/me/business/time-off/{timeOffId}", () =>
    apiClient(accessToken).DELETE("/api/v1/me/business/time-off/{timeOffId}", {
      params: { path: { timeOffId } },
    }),
  );
}
