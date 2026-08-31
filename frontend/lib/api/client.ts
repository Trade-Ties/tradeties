import "server-only";

import createClient from "openapi-fetch";

import type { paths } from "./schema";

/**
 * Server-only typed Spring backend client that forwards the WorkOS access token.
 */

/**
 * Internal backend URL with a local-development default.
 */
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8080";

export function apiClient(accessToken: string) {
  return createClient<paths>({
    baseUrl: API_BASE_URL,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * The same backend, asked as nobody in particular.
 *
 * For the handful of operations the contract marks `security: []` — the reference catalogues and
 * the customer search. Sending a token to those would work and would be wrong: it puts a
 * signed-in tradesperson's identity on a request whose answer must not depend on it, and it makes
 * every such page uncacheable for a reason nothing in the page needs.
 *
 * Separate from `apiClient` rather than an optional argument, so "is this call anonymous" is
 * visible at the call site instead of buried in whether a variable happened to be undefined.
 */
export function publicApiClient() {
  return createClient<paths>({ baseUrl: API_BASE_URL });
}
