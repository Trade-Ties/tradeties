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