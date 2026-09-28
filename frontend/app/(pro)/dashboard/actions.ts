"use server";

import { revalidatePath } from "next/cache";

import { signOut, withAuth } from "@workos-inc/authkit-nextjs";

import { registerAsTradesperson } from "@/lib/api/identity";
import * as api from "@/lib/api/inbox";
import { portalToken as token } from "@/lib/portal/session";
import { DASHBOARD_PATH } from "@/lib/routes";

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

  revalidatePath(DASHBOARD_PATH);
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
/**
 * What answering a request can end in, in the words the dashboard puts in front of somebody.
 *
 * `gone` is the one worth its own flag: the hour went while the page was open, and the only useful
 * move is to re-read the list. Everything else is either already answered or the backend being
 * unreachable, and neither is fixed by looking again.
 */
export type Answered =
  | { ok: true }
  | { ok: false; message: string; gone: boolean };

/** Takes the job. A 409 means somebody else's hour now; a 422 means this was already answered. */
export async function acceptRequest(requestId: string): Promise<Answered> {
  const result = await api.acceptJobRequest(await token(), requestId);

  if (result.ok) {
    revalidatePath(DASHBOARD_PATH);
    return { ok: true };
  }

  if (result.failure.status === 409) {
    return {
      ok: false,
      gone: true,
      message: result.failure.detail,
    };
  }

  return { ok: false, gone: false, message: result.failure.detail };
}

/**
 * Turns the job down, with the reason the customer will be given.
 *
 * Declining commits no calendar, so it cannot lose a race — the only refusal it meets is a request
 * that was already answered.
 */
export async function declineRequest(requestId: string, reason: string): Promise<Answered> {
  const result = await api.declineJobRequest(await token(), requestId, reason);

  if (result.ok) {
    revalidatePath(DASHBOARD_PATH);
    return { ok: true };
  }

  return { ok: false, gone: false, message: result.failure.detail };
}
