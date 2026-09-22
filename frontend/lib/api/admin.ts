import "server-only";

import { apiClient } from "./client";
import { attempt, type ApiResult } from "./problem";
import type { components } from "./schema";

export type CatalogSuggestion = components["schemas"]["CatalogSuggestion"];
export type SuggestionStatus = components["schemas"]["SuggestionStatus"];
export type ServiceJob = components["schemas"]["ServiceJob"];

/**
 * Phrases customers and tradespeople used that the catalogue has no name for, most asked first.
 *
 * Staff only, and the token is what says so — the role is granted out of band and the backend is
 * where it is checked, so nothing on this side decides who may read it.
 *
 * @param status which decisions to show. `NEW` is the queue; the other two are the record of what
 *        was already decided, kept so the same judgement is not made twice
 */
export function fetchCatalogSuggestions(
  accessToken: string,
  status: SuggestionStatus,
): Promise<ApiResult<CatalogSuggestion[]>> {
  return attempt("GET /api/v1/admin/service-catalog-suggestions", () =>
    apiClient(accessToken).GET("/api/v1/admin/service-catalog-suggestions", {
      params: { query: { status } },
    }),
  );
}

/**
 * Turns a collected phrase into a job the marketplace offers.
 *
 * **The label is not the phrase.** "my chimney flue is cracked" is how somebody described a
 * problem; "Repair a cracked chimney flue" is what the job should be called. Making that
 * translation is the work, and the reason a person does this rather than a rule.
 *
 * Takes effect with no deployment: from the moment this returns, customers are offered the job
 * while they type and tradespeople can tick it in their own list.
 */
export function promoteCatalogSuggestion(
  accessToken: string,
  suggestionId: string,
  promotion: { label: string; tradeId: string; synonyms?: string | null },
): Promise<ApiResult<ServiceJob>> {
  return attempt("PUT /api/v1/admin/service-catalog-suggestions/{suggestionId}/promotion", () =>
    apiClient(accessToken).PUT(
      "/api/v1/admin/service-catalog-suggestions/{suggestionId}/promotion",
      { params: { path: { suggestionId } }, body: promotion },
    ),
  );
}

/** A typo, a duplicate, or a sentence describing no job — decided rather than deleted. */
export function dismissCatalogSuggestion(
  accessToken: string,
  suggestionId: string,
): Promise<ApiResult<void>> {
  return attempt("PUT /api/v1/admin/service-catalog-suggestions/{suggestionId}/dismissal", () =>
    apiClient(accessToken).PUT(
      "/api/v1/admin/service-catalog-suggestions/{suggestionId}/dismissal",
      { params: { path: { suggestionId } } },
    ),
  );
}
