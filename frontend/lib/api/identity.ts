import "server-only";

import { log } from "@/lib/log";

import { apiClient } from "./client";

import type { components } from "./schema";

export type CurrentUser = components["schemas"]["CurrentUser"];
export type MarketplaceRole = components["schemas"]["MarketplaceRole"];

/**
 * Whether this principal may act on behalf of a business — the single question the portal
 * asks. Mirrors `MarketplaceUser.isTradesperson()` on the backend.
 *
 * Roles are additive, so this is a membership test, not an equality check: a tradesperson
 * who also books work holds CUSTOMER as well.
 */
export function isTradesperson(user: CurrentUser | null): boolean {
  return user?.roles?.some((role) => role === "BUSINESS_OWNER" || role === "BUSINESS_MEMBER") ?? false;
}

/**
 * Why the backend refused, in its own words.
 *
 * An OAuth2 resource server states the reason for a 401 in the `WWW-Authenticate` header —
 * "The iss claim is not valid", "Couldn't retrieve remote JWK set", "Jwt expired". Discarding
 * it leaves a bare status code and guesswork: a client id that never reached the backend's
 * environment then looks exactly like a wrong issuer. That is not hypothetical — it is what
 * made the first sign-in take three attempts to diagnose.
 *
 * Carries no credentials. The header holds an error description and a spec link; the access
 * token is never logged.
 */
function describeRejection(response: Response, error: unknown): string {
  return response.headers.get("www-authenticate") ?? (error ? JSON.stringify(error) : "(no detail)");
}

/**
 * Reads the principal, returning `null` and logging the cause on HTTP or transport failures.
 * An empty `roles` array is a valid response for an unregistered user.
 */
export async function fetchCurrentUser(accessToken: string): Promise<CurrentUser | null> {
  try {
    const { data, error, response } = await apiClient(accessToken).GET("/api/v1/me");

    if (error || !response.ok) {
      log.error(
        {
          endpoint: "GET /api/v1/me",
          status: response.status,
          detail: describeRejection(response, error),
        },
        "Backend rejected the request",
      );
      return null;
    }

    return data ?? null;
  } catch (cause) {
    log.error({ endpoint: "GET /api/v1/me", err: cause }, "Backend unreachable");
    return null;
  }
}

/**
 * Idempotently assigns the tradesperson role on each sign-in.
 * The role is fixed while `/portal` remains the only authentication entry point.
 */
export async function registerAsTradesperson(accessToken: string): Promise<CurrentUser | null> {
  try {
    const { data, error, response } = await apiClient(accessToken).POST("/api/v1/me/registration", {
      body: { intent: "TRADESPERSON" },
    });

    if (error || !response.ok) {
      log.error(
        {
          endpoint: "POST /api/v1/me/registration",
          status: response.status,
          detail: describeRejection(response, error),
        },
        "Backend rejected the request",
      );
      return null;
    }

    return data ?? null;
  } catch (cause) {
    log.error({ endpoint: "POST /api/v1/me/registration", err: cause }, "Backend unreachable");
    return null;
  }
}