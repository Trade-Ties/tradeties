import "server-only";

import { cache } from "react";

import { withAuth } from "@workos-inc/authkit-nextjs";

import { fetchCurrentUser } from "@/lib/api/identity";

/**
 * Returns the authenticated WorkOS user and their TradeTies roles, redirecting if unsigned.
 * Cached so layouts and pages share one backend call per request.
 */
export const portalSession = cache(async () => {
  const { user, accessToken } = await withAuth({ ensureSignedIn: true });

  return {
    user,
    accessToken,
    /** `null` if the backend was unreachable; empty roles if signed in but not registered. */
    marketplaceUser: await fetchCurrentUser(accessToken),
  };
});