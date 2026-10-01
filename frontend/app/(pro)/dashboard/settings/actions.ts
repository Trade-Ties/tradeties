"use server";

import { getWorkOS, withAuth } from "@workos-inc/authkit-nextjs";

/**
 * A new password for the signed-in professional, set through WorkOS — the sign-in provider holds
 * the password, never TradeTies.
 *
 * <p>The current password is checked first, by signing in with it: a session left open on a shared
 * computer must not be enough to take the account over. An account that signs in some other way —
 * with Google, say — has no password to check, and is told so in the same words as a wrong one,
 * since WorkOS does not say which it was.
 *
 * @returns an error to show, or null when the password was changed
 */
export async function changePassword(current: string, next: string): Promise<string | null> {
  const { user } = await withAuth({ ensureSignedIn: true });
  const clientId = process.env.WORKOS_CLIENT_ID;
  if (!clientId) return "Passwords cannot be changed here just now. Please try again later.";

  const workos = getWorkOS();

  try {
    await workos.userManagement.authenticateWithPassword({ clientId, email: user.email, password: current });
  } catch {
    return "Your current password is not right. If you sign in with Google or a link, there is no password to change here.";
  }

  try {
    await workos.userManagement.updateUser({ userId: user.id, password: next });
  } catch (error) {
    // WorkOS refuses a password its policy finds too weak or too common, and says why.
    const reason = error instanceof Error && error.message ? ` ${error.message}` : "";
    return `That new password was not accepted.${reason}`;
  }

  return null;
}
