"use server";

import { createJob, type CreatedJob, type JobInput } from "@/lib/api/marketplace";
import { INVALID_SELECTION, SLOT_NOT_OFFERED } from "@/lib/api/failure";

/**
 * Sending the request, from the browser to the backend by way of the Next server.
 *
 * A server action rather than a fetch from the page, for the reason every other write here is
 * one: the browser cannot reach `API_BASE_URL`. Unlike the others it authenticates nothing,
 * because there is nobody to authenticate — this is the anonymous half of the marketplace.
 */

/**
 * What the form gets back.
 *
 * `stale` is the one failure worth its own flag rather than its own sentence: it is the only one
 * a customer fixes by going back to the calendar, and the form turns it into a link there.
 */
export type Sent =
  | { ok: true; created: CreatedJob }
  | { ok: false; message: string; stale: boolean };

export async function sendRequest(input: JobInput): Promise<Sent> {
  const result = await createJob(input);

  if (result.ok) {
    return { ok: true, created: result.data };
  }

  const { status, type, detail } = result.failure;

  if (type === SLOT_NOT_OFFERED) {
    return {
      ok: false,
      stale: true,
      message:
        "That time is no longer free — somebody else was accepted onto it while this page was open.",
    };
  }

  if (type === INVALID_SELECTION) {
    return {
      ok: false,
      stale: true,
      message: "This business no longer offers that service. Open their profile and choose again.",
    };
  }

  if (status === 404) {
    return {
      ok: false,
      stale: true,
      message: "That business is no longer listed on TradeTies.",
    };
  }

  // Everything else is either this client's own bug or the backend being unreachable, and
  // `detail` is already a sentence written for people in both cases.
  return { ok: false, stale: false, message: detail };
}
