"use server";

import { revalidatePath } from "next/cache";

import { sendMessage } from "@/lib/api/inbox";
import { portalToken } from "@/lib/portal/session";
import { INBOX_PATH } from "@/lib/routes";

/**
 * A reply to the customer, from the inbox. The backend stores it and emails it to them with a
 * fresh link; the page reads the conversation again afterwards to show it.
 *
 * @returns an error to show, or null when it went
 */
export async function replyToCustomer(requestId: string, body: string): Promise<string | null> {
  const text = body.trim();
  if (text === "") return "Write something first.";

  const result = await sendMessage(await portalToken(), requestId, text);
  if (!result.ok) {
    return result.failure.status === 404
      ? "This conversation is no longer yours to answer."
      : "Your reply could not be sent just now. Please try again.";
  }

  revalidatePath(INBOX_PATH);
  return null;
}
