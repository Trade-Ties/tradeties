import "server-only";

import { cache } from "react";

import { withAuth } from "@workos-inc/authkit-nextjs";

import { fetchCurrentUser } from "@/lib/api/identity";

/**
 * The caller's access token, without the roles that come with it.
 *
 * Split out so a page's data fetches can start without waiting for `/api/v1/me`: the roles gate
 * what is rendered, not what may be fetched. `withAuth` only reads the session the proxy put on
 * the request, so asking for it twice costs nothing.
 */
export const portalToken = cache(async () => {
  const { accessToken } = await withAuth({ ensureSignedIn: true });

  return accessToken;
});

/** The signed-in user and their TradeTies roles. Redirects instead of returning if unsigned. */
export const portalSession = cache(async () => {
  const { user, accessToken } = await withAuth({ ensureSignedIn: true });

  return {
    user,
    accessToken,
    marketplaceUser: await fetchCurrentUser(accessToken),
  };
});
