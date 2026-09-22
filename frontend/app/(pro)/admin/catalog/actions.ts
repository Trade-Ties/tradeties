"use server";

import { revalidatePath } from "next/cache";

import * as api from "@/lib/api/admin";
import type { ApiFailure } from "@/lib/api/failure";
import { portalToken as token } from "@/lib/portal/session";

/**
 * A server action is a POST endpoint like any other, and having been rendered inside a guarded
 * page says nothing about who calls it later — so each one authenticates itself. `portalToken`
 * redirects rather than returns when unsigned, and the backend checks the staff role on top:
 * nothing on this side decides who may promote a job.
 */

const CATALOG_QUEUE_PATH = "/admin/catalog";

export type Decision = { ok: true } | { ok: false; message: string };

export async function promote(
  suggestionId: string,
  label: string,
  tradeId: string,
  synonyms: string,
): Promise<Decision> {
  const result = await api.promoteCatalogSuggestion(await token(), suggestionId, {
    label,
    tradeId,
    // Empty is absent rather than an empty string: the column means "no synonyms recorded", and
    // a blank one would read as a set of them that happens to contain nothing.
    synonyms: synonyms.trim() || null,
  });

  if (!result.ok) {
    return { ok: false, message: messageFor(result.failure) };
  }

  revalidatePath(CATALOG_QUEUE_PATH);
  return { ok: true };
}

export async function dismiss(suggestionId: string): Promise<Decision> {
  const result = await api.dismissCatalogSuggestion(await token(), suggestionId);

  if (!result.ok) {
    return { ok: false, message: messageFor(result.failure) };
  }

  revalidatePath(CATALOG_QUEUE_PATH);
  return { ok: true };
}

/**
 * The backend's own sentence where there is one.
 *
 * Every refusal here is something the person reading it can act on — the job already has an
 * entry, somebody else decided this phrase first — so replacing those with a wording of our own
 * would replace the only useful part of the answer.
 */
function messageFor(failure: ApiFailure): string {
  return failure.detail || "That did not work. Try again.";
}
