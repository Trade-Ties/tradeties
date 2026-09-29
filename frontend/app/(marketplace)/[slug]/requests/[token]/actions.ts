"use server";

import { revalidatePath } from "next/cache";

import { sendCustomerMessage } from "@/lib/api/marketplace";

export type SendState = { status: "idle" } | { status: "sent" } | { status: "failed"; message: string };

/**
 * The customer's reply, sent from the server.
 *
 * The token rides in the page's address and reaches this action as a bound argument, never
 * through the browser's JavaScript — the form posts the text and nothing else, and the token goes
 * on to the API in a header from here.
 */
export async function sendReply(
  token: string,
  requestId: string,
  path: string,
  _previous: SendState,
  form: FormData,
): Promise<SendState> {
  const body = String(form.get("body") ?? "").trim();
  if (body === "") {
    return { status: "failed", message: "Write something first." };
  }

  const result = await sendCustomerMessage(token, requestId, body);
  if (!result.ok) {
    return {
      status: "failed",
      message:
        result.failure.status === 404
          ? "This link no longer opens your request, so the message could not be sent."
          : "Your message could not be sent just now. Please try again in a moment.",
    };
  }

  // The page reads the conversation on the server; this is what shows the new message on it.
  revalidatePath(path);
  return { status: "sent" };
}
