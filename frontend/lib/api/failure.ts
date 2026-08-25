/**
 * How a failed backend call is described, on both sides of the wire.
 *
 * Kept out of `problem.ts` because that module opens with `import "server-only"` and pulls in
 * the logger — but the wizard runs in the browser and has to *read* these: it shows `detail`
 * on the form and branches on `type` for the one problem the contract says a client must tell
 * apart. Building a failure is still server work and still lives next door.
 */

/**
 * The two problem types a client must recognise, per the contract. Match on these, never on
 * `detail` — the wording is written for people and will be reworded.
 *
 * A time zone change that would move an existing calendar and has not been confirmed: ask, and
 * send the same body again with the flag set.
 */
export const UNCONFIRMED_TIME_ZONE_CHANGE = "urn:tradeties:problem:unconfirmed-time-zone-change";

/**
 * The URL was fixed by a publish this client did not know about — a second tab, most likely.
 * Re-read the profile and put the stored URL back; resending is refused identically forever.
 */
export const SLUG_LOCKED = "urn:tradeties:problem:slug-locked";

/**
 * Removing that service would take a published profile off the marketplace. Put `detail` to the
 * tradesperson and send the same request again with `unpublishConfirmed`, or send nothing.
 */
export const UNCONFIRMED_UNPUBLISH = "urn:tradeties:problem:unconfirmed-unpublish";

/**
 * The status carried when the request never reached the backend at all.
 *
 * Zero rather than 503: nothing answered, so there is no status to report. Callers that branch
 * on 409 or 422 fall through to their generic case, which is the correct handling for "we do
 * not know whether this was written".
 */
export const NO_RESPONSE = 0;

/**
 * What somebody is told when the request never reached the backend.
 *
 * Here rather than beside the function that builds the failure, because both sides of the wire
 * say it: the server side for a backend it could not reach, and the wizard for a server action
 * whose call never left the browser.
 */
export const UNREACHABLE_DETAIL =
  "TradeTies could not be reached. Your last change was not saved.";

/**
 * What somebody is told when the backend refused but said nothing a person can read.
 *
 * Every refusal this API makes on purpose carries an RFC 9457 `detail`, so reaching this means
 * something answered that was not the application: an HTML error page from a gateway, an empty
 * 500, a 502 whose reason phrase is blank — which over HTTP/2 is all of them, the protocol
 * having dropped the reason phrase. Without a last resort the failure carries an empty string,
 * and the wizard shows its red strip on `!== null` rather than on having something to say.
 */
export const UNEXPLAINED_DETAIL =
  "TradeTies could not complete that just now. Your last change was not saved.";

export interface ApiFailure {
  /** HTTP status, or `NO_RESPONSE` when the backend could not be reached. */
  status: number;
  /** RFC 9457 `type`. `about:blank` unless the problem is one a client has to tell apart. */
  type: string;
  /** Phrased for the tradesperson. Safe to show; never safe to branch on. */
  detail: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; failure: ApiFailure };

/**
 * A write refused because the version sent was not the one stored — for this wizard, almost
 * always the same person in a second tab.
 *
 * Named here rather than compared as `409` at the call site: the wire number is this module's
 * to know, and a caller spelling it itself is a second place to change.
 */
export const isVersionConflict = (failure: ApiFailure): boolean => failure.status === 409;

/**
 * A delete whose row was already gone, which is the outcome asked for rather than a failure.
 *
 * Reached on a retry after a step that deleted and then failed further down: the bookkeeping
 * still lists the row, because it is only replaced by a step that finished.
 */
export const isAlreadyGone = (failure: ApiFailure): boolean => failure.status === 404;
