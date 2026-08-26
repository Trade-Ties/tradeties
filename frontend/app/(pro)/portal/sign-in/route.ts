import { redirect } from "next/navigation";

import { getSignInUrl } from "@workos-inc/authkit-nextjs";

import { DASHBOARD_PATH } from "@/lib/routes";

/**
 * Starts sign-in in a route handler so AuthKit can set the required PKCE cookie.
 * This keeps the portal links JavaScript-free.
 */
export async function GET() {
  redirect(await getSignInUrl({ returnTo: DASHBOARD_PATH }));
}