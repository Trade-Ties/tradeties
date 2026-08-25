import "server-only";

import { log } from "@/lib/log";

import {
  NO_RESPONSE,
  UNEXPLAINED_DETAIL,
  UNREACHABLE_DETAIL,
  type ApiFailure,
  type ApiResult,
} from "./failure";

import type { components } from "./schema";

/**
 * How a failed backend call reaches the wizard.
 *
 * Failures are not collapsed to `null` the way `identity.ts` collapses them: a slug taken in
 * the meantime, a stale `version`, a caller without the business role and a backend that is
 * simply down each need a different answer from the wizard.
 */

export type Problem = components["schemas"]["Problem"];

export type { ApiFailure, ApiResult };

function isProblem(value: unknown): value is Problem {
  return (
    typeof value === "object" &&
    value !== null &&
    ("type" in value || "title" in value || "detail" in value)
  );
}

/**
 * An OAuth2 resource server states the reason for a 401 in `WWW-Authenticate` rather than in a
 * body — "The iss claim is not valid", "Jwt expired" — so that header is the only detail a 401
 * has. It carries no credentials, only an error description and a spec link.
 */
export function failureOf(endpoint: string, response: Response, error: unknown): ApiFailure {
  const problem = isProblem(error) ? error : null;

  const failure: ApiFailure = {
    status: response.status,
    type: problem?.type ?? "about:blank",
    // Down to a last resort that is always a sentence. `statusText` is empty over HTTP/2 by
    // design, so without one the chain bottoms out at "" — see `UNEXPLAINED_DETAIL`.
    detail:
      problem?.detail ??
      problem?.title ??
      response.headers.get("www-authenticate") ??
      (response.statusText || UNEXPLAINED_DETAIL),
  };

  log.error({ endpoint, ...failure }, "Backend rejected the request");

  return failure;
}

export function unreachable(endpoint: string, cause: unknown): ApiFailure {
  log.error({ endpoint, err: cause }, "Backend unreachable");

  return {
    status: NO_RESPONSE,
    type: "about:blank",
    detail: UNREACHABLE_DETAIL,
  };
}

/**
 * What `openapi-fetch` hands back, in the shape this module consumes it.
 *
 * Its real return type is a union — data present or error present, never both — and both
 * arms satisfy this. Restating it structurally keeps the helpers below generic over one type
 * parameter instead of over the whole path/method/media-type tuple.
 */
export type Fetched<T> = { data?: T; error?: unknown; response: Response };

/**
 * One call's raw outcome: either something answered, or nothing did.
 *
 * The refusal body is left on the `reached` arm rather than folded into a failure, because a
 * refusal is not always a problem detail — `publishMyBusiness` reads a 422 body as the
 * readiness checklist. Callers that have nothing to read in a refusal use `attempt` instead.
 */
export type Answer<T> =
  | { reached: true; data?: T; error: unknown; response: Response }
  | { reached: false; failure: ApiFailure };

/**
 * The `try` is for the third outcome, never answered at all: a fetch that throws would
 * otherwise surface as a rendering error rather than as a message in the form.
 */
export async function answer<T>(
  endpoint: string,
  call: () => Promise<Fetched<T>>,
): Promise<Answer<T>> {
  try {
    const { data, error, response } = await call();

    return { reached: true, data, error, response };
  } catch (cause) {
    return { reached: false, failure: unreachable(endpoint, cause) };
  }
}

/** The common case: anything but a 2xx is described as a failure and logged. */
export async function attempt<T>(
  endpoint: string,
  call: () => Promise<Fetched<T>>,
): Promise<ApiResult<T>> {
  const answered = await answer(endpoint, call);

  if (!answered.reached) {
    return { ok: false, failure: answered.failure };
  }

  if (!answered.response.ok) {
    return { ok: false, failure: failureOf(endpoint, answered.response, answered.error) };
  }

  return { ok: true, data: answered.data as T };
}
