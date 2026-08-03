import { redirect } from "next/navigation";

import { getSignInUrl } from "@workos-inc/authkit-nextjs";

/**
 * Starts sign-in in a route handler so AuthKit can set the required PKCE cookie.
 * This keeps the portal links JavaScript-free.
 */
export async function GET() {
  redirect(await getSignInUrl({ returnTo: "/dashboard" }));
}