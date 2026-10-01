"use server";

import { revalidatePath } from "next/cache";

import {
  deleteConversation,
  getConversation,
  markConversationRead,
  sendMessage,
  type Conversation as ConversationData,
} from "@/lib/api/inbox";
import { portalToken } from "@/lib/portal/session";
import { DASHBOARD_PATH, INBOX_PATH } from "@/lib/routes";


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
  revalidatePath(DASHBOARD_PATH);
  return null;
}

/**
 * Takes a conversation out of the inbox. The customer is told nothing, and writing again brings it
 * back.
 *
 * @returns an error to show, or null when it went
 */
export async function removeConversation(requestId: string): Promise<string | null> {
  const result = await deleteConversation(await portalToken(), requestId);
  if (!result.ok) {
    return result.failure.status === 404
      ? "This conversation is no longer in your inbox."
      : "The conversation could not be deleted just now. Please try again.";
  }

  revalidatePath(INBOX_PATH);
  return null;
}

/**
 * One conversation, whole, for the dashboard's side panel — opened, so it counts as read. Null when
 * it cannot be read, or is no longer the caller's.
 *
 * As the API answers it: the browser turns it into the thread and the request, so the request's day
 * is built on the browser's clock like every other day the dashboard draws.
 */
export async function openConversation(requestId: string): Promise<ConversationData | null> {
  const token = await portalToken();
  await markConversationRead(token, requestId);
  const found = await getConversation(token, requestId);
  if (!found.ok || found.data === null) return null;

  revalidatePath(DASHBOARD_PATH);
  return found.data;
}
