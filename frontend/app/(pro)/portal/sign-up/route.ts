import { redirect } from "next/navigation";

import { getSignUpUrl } from "@workos-inc/authkit-nextjs";

import { DASHBOARD_PATH } from "@/lib/routes";

/**
 * Starts sign-up via AuthKit; the callback handles marketplace registration,
 * while the backend assigns roles.
 */
export async function GET() {
  redirect(await getSignUpUrl({ returnTo: DASHBOARD_PATH }));
}