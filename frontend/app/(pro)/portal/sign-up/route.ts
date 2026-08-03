import { redirect } from "next/navigation";

import { getSignUpUrl } from "@workos-inc/authkit-nextjs";

/**
 * Starts sign-up via AuthKit; the callback handles marketplace registration,
 * while the backend assigns roles.
 */
export async function GET() {
  redirect(await getSignUpUrl({ returnTo: "/dashboard" }));
}