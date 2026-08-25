import "server-only";

import { apiClient } from "./client";
import { attempt } from "./problem";

import type { components } from "./schema";

export type CurrentUser = components["schemas"]["CurrentUser"];

/**
 * Mirrors `MarketplaceUser.isTradesperson()` on the backend.
 *
 * Roles are additive, so this is a membership test, not an equality check: a tradesperson who
 * also books work holds CUSTOMER as well.
 */
export function isTradesperson(user: CurrentUser | null): boolean {
  return user?.roles?.some((role) => role === "BUSINESS_OWNER" || role === "BUSINESS_MEMBER") ?? false;
}

/**
 * `null` on any HTTP or transport failure, with the cause logged by `attempt`. An empty `roles`
 * array is a valid response rather than a failure: signed in, but not registered.
 */
export async function fetchCurrentUser(accessToken: string): Promise<CurrentUser | null> {
  const result = await attempt<CurrentUser>("GET /api/v1/me", () =>
    apiClient(accessToken).GET("/api/v1/me"),
  );

  return result.ok ? (result.data ?? null) : null;
}

/**
 * Idempotent: reassigns the role on every sign-in. The role is fixed while `/portal` remains the
 * only authentication entry point.
 */
export async function registerAsTradesperson(accessToken: string): Promise<CurrentUser | null> {
  const result = await attempt<CurrentUser>("POST /api/v1/me/registration", () =>
    apiClient(accessToken).POST("/api/v1/me/registration", { body: { intent: "TRADESPERSON" } }),
  );

  return result.ok ? (result.data ?? null) : null;
}
