"use server";

import { revalidatePath } from "next/cache";

import { signOut, withAuth } from "@workos-inc/authkit-nextjs";

import { registerAsTradesperson } from "@/lib/api/identity";

/**
 * Retries the registration the callback route attempts on every sign-in.
 *
 * Only reachable from the "registration incomplete" state, which the user sees when the
 * backend was down at the moment they signed in. Idempotent, so pressing it when
 * registration in fact succeeded changes nothing.
 */
export async function retryRegistration() {
  const { accessToken } = await withAuth({ ensureSignedIn: true });

  await registerAsTradesperson(accessToken);

  revalidatePath("/dashboard");
}

/**
 * Signs out and returns to the public marketplace, not to the portal.
 *
 * Deliberately without `returnTo`. That value is passed straight through to WorkOS as
 * `return_to`, which has to be an absolute URL and has to be registered under Sign-out URIs
 * — WorkOS validates it to prevent open redirects. Omitting it makes WorkOS use the
 * App homepage URL configured for the environment, which is the destination we want anyway.
 *
 * The point is not that it saves a dashboard entry: it moves the sign-out destination into
 * per-environment configuration instead of hard-coding a localhost URL that production
 * would have to override.
 */
export async function signOutFromPortal() {
  await signOut();
}