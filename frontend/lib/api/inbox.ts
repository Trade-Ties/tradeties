import "server-only";

import { apiClient } from "./client";
import { attempt, type ApiResult } from "./problem";
import type { components } from "./schema";

type Schemas = components["schemas"];

export type ConversationSummary = Schemas["ConversationSummary"];
export type Conversation = Schemas["Conversation"];
export type Message = Schemas["Message"];

/**
 * The tradesperson's side of every conversation with a customer — the inbox's data.
 *
 * Each call resolves the business from the access token, and a request id that is not the
 * caller's answers 404: callers show that as "not found", never as somebody else's conversation.
 */

/** Every conversation, latest activity first. A 404 means no business yet, and reads as none. */
export async function listConversations(accessToken: string): Promise<ApiResult<ConversationSummary[]>> {
  const result = await attempt("GET /api/v1/me/conversations", () =>
    apiClient(accessToken).GET("/api/v1/me/conversations"),
  );

  if (!result.ok && result.failure.status === 404) {
    return { ok: true, data: [] };
  }
  return result;
}

/** One conversation with the request it is about. `null` when it is not the caller's. */
export async function getConversation(
  accessToken: string,
  requestId: string,
): Promise<ApiResult<Conversation | null>> {
  const result = await attempt("GET /api/v1/me/conversations/{requestId}", () =>
    apiClient(accessToken).GET("/api/v1/me/conversations/{requestId}", {
      params: { path: { requestId } },
    }),
  );

  if (!result.ok && result.failure.status === 404) {
    return { ok: true, data: null };
  }
  return result;
}

/** A reply to the customer — stored, and emailed to them with a fresh link back. */
export function sendMessage(accessToken: string, requestId: string, body: string): Promise<ApiResult<Message>> {
  return attempt("POST /api/v1/me/conversations/{requestId}/messages", () =>
    apiClient(accessToken).POST("/api/v1/me/conversations/{requestId}/messages", {
      params: { path: { requestId } },
      body: { body },
    }),
  );
}

/** Everything the customer wrote so far, seen. */
export function markConversationRead(accessToken: string, requestId: string): Promise<ApiResult<unknown>> {
  return attempt("POST /api/v1/me/conversations/{requestId}/read", () =>
    apiClient(accessToken).POST("/api/v1/me/conversations/{requestId}/read", {
      params: { path: { requestId } },
    }),
  );
}
