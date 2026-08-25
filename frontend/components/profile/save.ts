import * as actions from "@/app/(pro)/profile/create/actions";
import {
  SLUG_LOCKED,
  UNCONFIRMED_TIME_ZONE_CHANGE,
  UNCONFIRMED_UNPUBLISH,
  isAlreadyGone,
  isVersionConflict,
} from "@/lib/api/failure";
import type { ApiFailure, ApiResult } from "@/lib/api/failure";

import { emptyFormData } from "./constants";
import {
  contentOf,
  toBookingPolicy,
  toCreateBusiness,
  toLicense,
  toPricing,
  toService,
  toTrades,
  toUpdateBusiness,
  toWorkingHours,
} from "./toWire";
import type {
  ProfileFormData,
  ServerRow,
  ServiceForm,
  StepKey,
  StoredList,
  StoredState,
} from "./types";
import {
  claimedTradeIds,
  duplicateLicenseKeys,
  duplicateServiceNames,
  licenseIsWritable,
  pricingIsWritable,
  profileIsWritable,
  serviceIsWritable,
  workingHoursAreWritable,
} from "./validate";

/**
 * Writing one step of the wizard, a step at a time rather than a form at a time.
 *
 * `onboardingCompletedStep` is `readOnly` in the contract and set by whichever endpoint was
 * called, so the server's idea of how far somebody got follows from what has been written.
 * Saving everything at the end would take that value from 2 straight to 9 and leave nothing to
 * resume from in between.
 *
 * Each function here covers one screen and returns the form and the bookkeeping as they now
 * stand — rows carrying the server ids they were just given, versions advanced. Returning them
 * rather than mutating anything is what keeps a failed save from moving the form half a step.
 */

/**
 * Why a step was not written, where not writing it was the right thing to do. None of them is a
 * failure: they are the moments where the wizard has nothing the server would accept yet.
 */
export type Deferral =
  /**
   * Steps 1 and 2 are not complete. `business_profile` has both names, the phone, the email,
   * the whole address and the time zone as `NOT NULL`, so there is no half of this to store.
   */
  | "profile-incomplete"
  /**
   * There is no business yet, so there is nothing for this step to hang off. Every endpoint
   * from step 3 on resolves the business from the token and answers 404 without one.
   */
  | "no-profile-yet"
  /**
   * A charging mode on the Pricing screen is missing the amount it names.
   *
   * The one step whose completeness only this side can ask about before sending: the contract
   * makes every amount nullable whatever the mode says, so an empty box is a legal body that
   * `PricingService.requireCoherent` then refuses whole.
   */
  | "pricing-incomplete"
  /**
   * Two ranges on one day run into each other.
   *
   * `CalendarService.requireCoherent` refuses the whole week over it, and the message names a
   * day rather than a range — so it arrives on whichever screen the wizard has moved to, about
   * ranges that are no longer on it. Held back here instead, where the step badges both sides.
   */
  | "hours-overlap"
  /**
   * A row on one of the two list steps is not complete enough to be written.
   *
   * Only ever reported on the way out. Within the wizard an unfinished row is somebody
   * mid-thought — it keeps its badge and stays in the form — but the form lives in one
   * component, so leaving is where "not written" becomes "gone".
   */
  | "services-incomplete"
  | "licenses-incomplete";

export type SaveOutcome =
  | {
      ok: true;
      formData: ProfileFormData;
      stored: StoredState;
      /** Present when the step was deliberately not sent. Absent means it was written. */
      deferred?: Deferral;
      /**
       * Whether at least one request actually went out, which is what the wizard busts the
       * dashboard's cached card on. A step that matched what was already stored sends nothing
       * and says so by leaving this unset. See `refreshDashboard`.
       */
      wrote?: boolean;
    }
  | {
      ok: false;
      failure: ApiFailure;
      /**
       * Present when part of the step landed before the refusal.
       *
       * The caller has to take these even though the step failed: drop them and the retry sees
       * rows with no server id, creates them a second time, and the step is stuck behind a
       * duplicate it made itself.
       */
      formData?: ProfileFormData;
      stored?: StoredState;
      /** As above, and set on a refusal too — a list step lands the rows before it. */
      wrote?: boolean;
    }
  /**
   * The two refusals that are questions rather than errors. Both are answered by putting
   * `detail` to the tradesperson and calling `saveStep` again with the matching option — never
   * by showing the sentence and stopping.
   *
   * `time-zone-change`: the zone moved and the business has working hours, so the contract wants
   * the calendar move confirmed before it follows.
   *
   * `unpublish`: the service being removed is the last one a live profile has, so removing it
   * takes the profile off the marketplace. Deliberately a question where a trade change is a
   * refusal — giving up a trade is not a request to stop trading, and this is.
   */
  | { ok: false; needsConfirmation: "time-zone-change"; detail: string }
  | { ok: false; needsConfirmation: "unpublish"; detail: string };

export type Confirmation = "time-zone-change" | "unpublish";

export interface SaveOptions {
  /** Resends the profile with `timeZoneChangeConfirmed`, after the question above was answered. */
  confirmTimeZoneChange?: boolean;
  /** Resends the removal with `unpublishConfirmed`, after that question was answered. */
  confirmUnpublish?: boolean;
  /**
   * Whether the screen this step covers has actually been open.
   *
   * Read by the three steps that are one resource, and only before their first write — see
   * `unchanged`, which is where the distinction is spent.
   */
  shown?: boolean;
  /**
   * Whether this save is on the way out of the wizard rather than to another step.
   *
   * The two list steps read it, and only to decide whether to say anything: a row they had to
   * hold back survives a move within the wizard and does not survive this one.
   */
  leaving?: boolean;
}

/** Carries a failure out of a helper without every caller restating the shape. */
class Refused extends Error {
  constructor(readonly failure: ApiFailure) {
    super(failure.detail);
  }
}

/** Unwraps a result, or aborts the step. The `catch` in `saveStep` is the other half. */
function must<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new Refused(result.failure);
  return result.data;
}

/**
 * Writes whatever the given step is responsible for. `publish` owns no resource, so it saves
 * nothing and says so by succeeding unchanged — publishing is its own action, and it asks the
 * server rather than writing to it.
 *
 * Every step is written the same way whether it is the one on screen or one being caught up
 * behind it, questions included. `business` is among the steps written behind, which is what
 * retries a save of steps 1 and 2 that was refused; a question raised there is carried up to
 * somebody who can answer it rather than dropped. See `writeSteps`.
 */
export async function saveStep(
  step: StepKey,
  formData: ProfileFormData,
  stored: StoredState,
  options: SaveOptions = {}
): Promise<SaveOutcome> {
  // Nothing below step 2 exists until the profile does, so a request from here would be a 404
  // dressed up as a failure. The answers stay in the form and are written by the flush that
  // follows the first successful save of steps 1 and 2.
  if (step !== "business" && stored.businessVersion === null) {
    return { ok: true, formData, stored, deferred: "no-profile-yet" };
  }

  try {
    switch (step) {
      case "business":
        return await saveBusiness(formData, stored, options);
      case "services":
        return await saveTradesAndServices(formData, stored, options);
      case "pricing":
        return await savePricing(formData, stored, options);
      case "availability":
        return await saveAvailability(formData, stored, options);
      case "licenses":
        return await saveLicenses(formData, stored, options);
      case "publish":
        return { ok: true, formData, stored };
    }
  } catch (error) {
    if (error instanceof Refused) return { ok: false, failure: error.failure };
    throw error;
  }
}

// --- Onboarding steps 1 and 2 — the profile --------------------------------

async function saveBusiness(
  formData: ProfileFormData,
  stored: StoredState,
  options: SaveOptions
): Promise<SaveOutcome> {
  const { profile: form } = formData;

  // All or nothing — see `profileIsWritable`. An incomplete body comes back as a 400 whose
  // whole message is "Invalid request content.", naming neither the step nor the field.
  if (!profileIsWritable(form)) {
    return { ok: true, formData, stored, deferred: "profile-incomplete" };
  }

  // The last lock before the body is assembled. `ProfileUrlField` and `BusinessStep` keep a
  // fixed URL out of reach in the UI, but neither sits between this form and the request, and
  // a resumed form is assembled somewhere else entirely.
  const written = stored.slugLocked && stored.slug !== null ? { ...form, slug: stored.slug } : form;

  const result =
    stored.businessVersion === null
      ? await actions.createBusiness(toCreateBusiness(written))
      : await actions.updateBusiness(
          toUpdateBusiness(
            written,
            stored.businessVersion,
            // Echoed back rather than dropped — see `StoredState.coordinates`.
            stored.coordinates,
            // True only once the question has been put and answered. Defaulting it would move
            // somebody's whole calendar without ever saying so.
            options.confirmTimeZoneChange === true
          )
        );

  if (!result.ok) {
    if (result.failure.type === UNCONFIRMED_TIME_ZONE_CHANGE) {
      return {
        ok: false,
        needsConfirmation: "time-zone-change",
        detail: result.failure.detail,
      };
    }

    // The URL was fixed by a publish this wizard did not see — a second tab. Both the lock and
    // the address are put right, or the same body is sent on every later save of this step and
    // refused identically, with nothing on screen saying which URL would be accepted.
    //
    // No `sent` on either arm: a refused create or update stored nothing, so there is no card
    // to bust.
    if (result.failure.type === SLUG_LOCKED) {
      return { ok: false, failure: result.failure, ...(await withStoredSlug(formData, stored)) };
    }

    // The same recovery `savePricing` and `saveAvailability` make, and it matters more here:
    // without it one stale-version 409 — a second tab, a publish from the dashboard — pins
    // `businessVersion` at the number that was just refused, and steps 1 and 2 stay unwritable
    // for as long as the wizard is open. Nothing in it reloads, so the only way out discards
    // what is on the screen.
    //
    // Only the version, and the refusal is still reported: the server's own words say the
    // profile changed elsewhere, which is what pressing Next again would write over.
    const current = await versionAfterConflict(result.failure, actions.loadBusiness);

    return {
      ok: false,
      failure: result.failure,
      stored: current === null ? stored : { ...stored, businessVersion: current },
    };
  }

  const profile = result.data;

  return sent(true, {
    ok: true,
    // The server settles the slug and the version. Reading them back is what keeps a second
    // save from sending a stale version and being refused for it.
    formData: {
      ...formData,
      profile: { ...written, slug: profile.slug },
    },
    stored: {
      ...stored,
      businessVersion: profile.version,
      slug: profile.slug,
      slugLocked: profile.slugLocked,
      coordinates: profile.coordinates ?? null,
      // Recorded as the form now stands, slug and all, so that asking a moment later whether
      // anything is unwritten answers no.
      profileBody: contentOf(toCreateBusiness({ ...written, slug: profile.slug })),
    },
  });
}

/**
 * The form and the bookkeeping with the stored URL put back, read from the server.
 *
 * Read rather than picked out of the refusal: `detail` names the address in prose, for a
 * person, and the contract warns against branching on it. If the read does not come back,
 * everything is handed over untouched and the failure is still reported.
 */
async function withStoredSlug(
  formData: ProfileFormData,
  stored: StoredState
): Promise<{ formData: ProfileFormData; stored: StoredState }> {
  const current = await actions.loadBusiness();

  if (!current.ok || current.data === null) return { formData, stored };

  const profile = current.data;

  return {
    formData: { ...formData, profile: { ...formData.profile, slug: profile.slug } },
    stored: {
      ...stored,
      slug: profile.slug,
      slugLocked: profile.slugLocked,
      businessVersion: profile.version,
    },
  };
}

// --- Onboarding steps 3 and 4 — trades and services ------------------------

/**
 * Both halves of one screen, and the order the writes go out in is the whole of it.
 *
 * Two rules pull against each other. The server refuses a service filed under a trade the
 * business has not claimed, so a newly ticked trade has to land *before* the services do. It
 * also retires the services filed under a trade that leaves — by the trade it holds them under,
 * not the one being typed — so a service being moved *off* a departing trade has to land
 * *before* that trade goes.
 *
 * Only one order satisfies both, and only when both are happening at once: widen the selection,
 * write the services while every trade they need is still held, then narrow to what was actually
 * chosen. See `rescued`, which is the only case that pays for the second request.
 */
async function saveTradesAndServices(
  formData: ProfileFormData,
  stored: StoredState,
  options: SaveOptions
): Promise<SaveOutcome> {
  const claimed = new Set(claimedTradeIds(formData.trades));
  const tradesBody = contentOf(toTrades(formData.trades));

  // Nothing to file services under yet, and the contract requires a primary trade — so an
  // untouched step is left alone rather than sent as an empty claim.
  //
  // Guarded like the three single-resource steps below, and it matters more here: this endpoint
  // re-runs the whole selection transaction — retiring links, removing the services filed under
  // the departing trades, re-checking the publish checklist — to store what it already holds.
  // No `UNTOUCHED` counterpart is needed, because an untouched step has no primary trade.
  const writesTrades =
    formData.trades.primaryTradeId !== "" && tradesBody !== stored.tradesBody;

  /**
   * The trade the server has a row filed under, which is not always the one the form shows.
   *
   * Read out of the body last confirmed for the row rather than off the row itself: re-filing a
   * service is an edit to `tradeId`, and until it has been written the server still has the row
   * where it was. Every decision below turns on that difference. A row the bookkeeping holds no
   * body for — one whose write was refused partway through an earlier attempt — falls back to
   * what the form says, which is the best guess there is and no worse than not asking.
   */
  const filedUnder = (row: ServiceForm, bodies: Record<string, string>): string => {
    const confirmed = row.serverId === undefined ? undefined : bodies[row.serverId];
    if (confirmed === undefined) return row.tradeId;

    return (JSON.parse(confirmed) as { tradeId?: string }).tradeId ?? row.tradeId;
  };

  /**
   * The rows being moved off a trade this write is about to retire.
   *
   * The step tells somebody to do exactly this — "Pick another trade, or this service goes with
   * it" — so it has to work. In the plain order it cannot: the trades write retires the row
   * first, and the move that follows is a `PUT` to a service that is no longer there.
   */
  const rescued = writesTrades
    ? formData.services.filter(
        (row) =>
          row.serverId !== undefined &&
          claimed.has(row.tradeId) &&
          !claimed.has(filedUnder(row, stored.services.bodies))
      )
    : [];

  let wrote = false;

  if (writesTrades) {
    if (rescued.length > 0) {
      // Both trades held at once for as long as it takes to move those rows: the departing one
      // because that is still where the server has them, the arriving one to file them under.
      // Only the departing trades some row is actually being rescued from — re-asserting a
      // trade the catalogue has since withdrawn would be refused, and nothing needs it.
      const alsoHeld = new Set(rescued.map((row) => filedUnder(row, stored.services.bodies)));
      alsoHeld.delete(formData.trades.primaryTradeId);

      must(
        await actions.saveTrades({
          primaryTradeId: formData.trades.primaryTradeId,
          additionalTradeIds: [
            ...new Set([...toTrades(formData.trades).additionalTradeIds, ...alsoHeld]),
          ],
        })
      );
    }
    else {
      must(await actions.saveTrades(toTrades(formData.trades)));
    }

    wrote = true;
  }

  const duplicates = duplicateServiceNames(formData.services);

  const saved = await syncList({
    rows: formData.services,
    stored: stored.services,
    // Shared with the step that badges the row, so what the screen calls incomplete and what
    // this refuses to send are the same thing rather than two guesses about it.
    isWritable: (row) => serviceIsWritable(row, duplicates, claimed),
    body: toService,
    create: (body) => actions.createService(body),
    update: (body, serverId, version) =>
      actions.updateService(serverId, { version, ...body }),
    remove: (serverId) => actions.deleteService(serverId, options.confirmUnpublish === true),
  });

  wrote = wrote || saved.wrote;

  // A question rather than a failure, and it has to be told apart here because `syncList` has no
  // way to put one. Nothing landed for it — the removal is refused whole — so there is nothing to
  // record on the way out; answering it replays this step with the flag set.
  if (saved.failure?.type === UNCONFIRMED_UNPUBLISH) {
    return { ok: false, needsConfirmation: "unpublish", detail: saved.failure.detail };
  }

  if (saved.failure !== undefined) {
    // `tradesBody` deliberately not recorded: in the widened case what the server holds is not
    // what the form says, and the next attempt has to send the selection again to settle it.
    return sent(wrote, {
      ok: false,
      failure: saved.failure,
      formData: { ...formData, services: saved.rows },
      stored: { ...stored, services: saved.list },
    });
  }

  // The selection as it was actually chosen, now that every move has landed. This is the write
  // that retires what is leaving, which is why the pruning below reads what the server holds
  // after it rather than before.
  if (writesTrades && rescued.length > 0) {
    must(await actions.saveTrades(toTrades(formData.trades)));
  }

  /**
   * The bookkeeping the rest of this function builds on, carrying the trades now that the
   * selection the form states is the one stored.
   */
  const afterTrades = writesTrades ? { ...stored, tradesBody } : stored;

  /**
   * What that write just retired: every row the server has under a trade the selection no longer
   * names. Read from the bodies `syncList` settled, so a row moved a moment ago counts as being
   * where it was moved to.
   *
   * They go from the form, which would otherwise keep showing a catalogue nothing holds, and
   * from the bookkeeping — exactly those ids and no others, because an id absent from the form
   * for the other reason, a row the tradesperson deleted, still has a `DELETE` owed on it.
   */
  const retired = new Set(
    writesTrades
      ? saved.rows
          .filter((row) => !claimed.has(filedUnder(row, saved.list.bodies)))
          .map((row) => row.serverId)
          .filter((id): id is string => id !== undefined)
      : []
  );

  const rows = saved.rows.filter(
    (row) => row.serverId === undefined || !retired.has(row.serverId)
  );
  const list: StoredList = { ...saved.list, ids: saved.list.ids.filter((id) => !retired.has(id)) };

  /**
   * The order the server has them in: the rows it already held, in the order it held them, then
   * the ones just created, which `addForOwner` appends. Compared against the form's order to
   * decide whether the drag needs sending at all — the endpoint rewrites every row's
   * `sortOrder`, so calling it on an unchanged list stores what was already there.
   */
  const serverOrder = [
    ...stored.services.ids.filter((id) => list.ids.includes(id)),
    ...list.ids.filter((id) => !stored.services.ids.includes(id)),
  ];

  let settled = rows;

  if (list.ids.length > 0 && !sameOrder(list.ids, serverOrder)) {
    const reordered = await actions.reorderServices(list.ids);

    if (!reordered.ok) {
      // Handed back rather than thrown: the ids in `list` were earned by requests that
      // succeeded, and a retry that could not see them would create every one of those
      // services again — service names being unique per business, that is a 409 against a name
      // the step took itself.
      //
      // The order recorded is the server's, not the form's. Recording the refused order would
      // make the next save compare it against itself and leave the drag silently unapplied.
      return sent(wrote, {
        ok: false,
        failure: reordered.failure,
        formData: { ...formData, services: rows },
        stored: { ...afterTrades, services: { ...list, ids: serverOrder } },
      });
    }

    wrote = true;

    // Rewriting `sortOrder` makes every moved row dirty, so the server bumps its `version` and
    // the answer has to be read back: a form still holding the version from before the drag
    // sends a stale one on the next edit and gets a 409 it cannot escape without a reload.
    const versions = new Map(reordered.data.map((service) => [service.id, service.version]));

    settled = rows.map((row) =>
      row.serverId !== undefined && versions.has(row.serverId)
        ? { ...row, version: versions.get(row.serverId) }
        : row
    );
  }

  return sent(wrote, {
    ok: true,
    formData: { ...formData, services: settled },
    stored: { ...afterTrades, services: list },
    // Only on the way out, where a row left unwritten is a row that is about to be gone. On a
    // move within the wizard it stays in the form with its badge, and saying so on every Next
    // would be a notice about something nobody has finished typing.
    //
    // Asked of the rows that survived rather than of `saved.held`: a row this write retired
    // along with its trade was also left unwritten, and it was removed on purpose.
    ...(options.leaving === true && unwritable(rows, claimed)
      ? { deferred: "services-incomplete" as const }
      : {}),
  });
}

const unwritable = (rows: ServiceForm[], claimed: ReadonlySet<string>): boolean => {
  const duplicates = duplicateServiceNames(rows);

  return rows.some((row) => !serviceIsWritable(row, duplicates, claimed));
};

const sameOrder = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Marks an outcome as having sent something, which is what busts the dashboard's cached card.
 *
 * Attached on every way out of a step, not only the happy one: a step refused halfway through
 * has still written what came before the refusal, and each of those writes moved
 * `onboardingCompletedStep`. See `SaveOutcome.wrote`.
 */
const sent = (wrote: boolean, outcome: SaveOutcome): SaveOutcome => ({ ...outcome, wrote });

// --- The three steps that are one resource ---------------------------------

/**
 * What each of these three looks like on the wire while nobody has answered it.
 *
 * The counterpart of `StoredList.bodies` for a step that is not a list: a row is recognised as
 * new by having no server id, and a resource cannot be. Before the first write there is no
 * stored body to compare against either, so "untouched" is stated as what the form itself
 * starts out holding rather than as a second description of the defaults.
 *
 * Without it the flush that follows the first save of steps 1 and 2 writes all three, and each
 * of those endpoints advances `onboardingCompletedStep` — so the server reports three screens
 * finished that were never shown, and the wizard reopens past every one.
 */
const UNTOUCHED = {
  profile: contentOf(toCreateBusiness(emptyFormData.profile)),
  trades: contentOf(toTrades(emptyFormData.trades)),
  pricing: contentOf(toPricing(emptyFormData.pricing, null)),
  workingHours: contentOf(toWorkingHours(emptyFormData.workingHours)),
  bookingPolicy: contentOf(toBookingPolicy(emptyFormData.bookingPolicy, 0)),
};

/**
 * Whether this step already says what the server holds, and so has nothing to send.
 *
 * Two questions rather than one, because before the first write there is no stored body to
 * compare against. Then it becomes whether the screen was ever open: what an untouched form
 * produces is somebody's answer the moment they have looked at it and moved on, and only a
 * screen nobody reached is still untouched.
 *
 * That second half is not a missed write. Rates and working hours are two of the five conditions
 * `PublishService` checks, and both defaults are perfectly legal on the wire — so a screen whose
 * defaults were accepted and never written greys the publish button out with nothing anywhere
 * disagreeing.
 */
function unchanged(
  content: string,
  storedBody: string | null,
  untouched: string,
  shown: boolean
): boolean {
  return storedBody === null ? !shown && content === untouched : content === storedBody;
}

/**
 * The version this resource is actually at, after a write was refused for sending a stale one.
 *
 * A 409 answers with a problem document rather than with the resource, so the form still holds
 * the version that was just refused and would send it again for as long as the wizard stays
 * open — a step nobody gets past without reloading the page.
 *
 * Only for a conflict, and only the version: what was typed on this screen is left as it is.
 */
async function versionAfterConflict<T extends { version: number }>(
  failure: ApiFailure,
  reread: () => Promise<ApiResult<T | null>>
): Promise<number | null> {
  if (!isVersionConflict(failure)) return null;

  const current = await reread();

  return current.ok && current.data !== null ? current.data.version : null;
}

// --- Onboarding step 5 — rates and terms -----------------------------------

async function savePricing(
  formData: ProfileFormData,
  stored: StoredState,
  options: SaveOptions
): Promise<SaveOutcome> {
  // Held rather than sent. A travel or material charge with no amount behind it is refused as a
  // 400 about the whole body, and by the time it arrives the wizard has moved on — so the one
  // message names a box on the screen it just left.
  if (!pricingIsWritable(formData.pricing)) {
    return { ok: true, formData, stored, deferred: "pricing-incomplete" };
  }

  const body = toPricing(formData.pricing, stored.pricingVersion);
  const content = contentOf(body);

  if (unchanged(content, stored.pricingBody, UNTOUCHED.pricing, options.shown === true)) {
    return { ok: true, formData, stored };
  }

  const result = await actions.savePricing(body);

  if (!result.ok) {
    const current = await versionAfterConflict(result.failure, actions.loadPricing);

    // Refused means nothing was stored, so nothing on the dashboard has gone stale.
    return {
      ok: false,
      failure: result.failure,
      formData,
      stored: current === null ? stored : { ...stored, pricingVersion: current },
    };
  }

  return sent(true, {
    ok: true,
    formData,
    stored: { ...stored, pricingVersion: result.data.version, pricingBody: content },
  });
}

// --- Onboarding steps 7 and 8 — the working week and the booking rules -----

async function saveAvailability(
  formData: ProfileFormData,
  stored: StoredState,
  options: SaveOptions
): Promise<SaveOutcome> {
  const shown = options.shown === true;

  // Held rather than sent, for the reason `savePricing` holds an incomplete mode: the server
  // refuses the week whole, and by the time it answers this screen has been left.
  if (!workingHoursAreWritable(formData.workingHours)) {
    return { ok: true, formData, stored, deferred: "hours-overlap" };
  }

  // Two resources behind one screen, so what the first settles is recorded before the second
  // is attempted. The week is replaced wholesale — `replaceWeek` deletes every row and inserts
  // it again — so a retry that rewrote it would store the whole week a second time, unchanged.
  let next = stored;
  let wrote = false;

  const days = toWorkingHours(formData.workingHours);
  const week = contentOf(days);

  if (!unchanged(week, stored.workingHoursBody, UNTOUCHED.workingHours, shown)) {
    const hours = await actions.saveWorkingHours(days);

    // `wrote` is set only once a write has landed, so a refusal here reports nothing sent — the
    // refused write stored nothing, and the booking rules below have not been attempted yet.
    if (!hours.ok) return { ok: false, failure: hours.failure, formData, stored: next };

    wrote = true;
    next = { ...next, workingHoursBody: week };
  }

  const body = toBookingPolicy(formData.bookingPolicy, stored.bookingPolicyVersion);
  const content = contentOf(body);

  if (unchanged(content, stored.bookingPolicyBody, UNTOUCHED.bookingPolicy, shown)) {
    return sent(wrote, { ok: true, formData, stored: next });
  }

  const policy = await actions.saveBookingPolicy(body);

  if (!policy.ok) {
    const current = await versionAfterConflict(policy.failure, actions.loadBookingPolicy);

    return sent(wrote, {
      ok: false,
      failure: policy.failure,
      formData,
      stored: current === null ? next : { ...next, bookingPolicyVersion: current },
    });
  }

  return sent(true, {
    ok: true,
    formData,
    stored: {
      ...next,
      bookingPolicyVersion: policy.data.version,
      bookingPolicyBody: content,
    },
  });
}

// --- Onboarding step 6 — licences ------------------------------------------

async function saveLicenses(
  formData: ProfileFormData,
  stored: StoredState,
  options: SaveOptions
): Promise<SaveOutcome> {
  const duplicates = duplicateLicenseKeys(formData.licenses);

  const saved = await syncList({
    rows: formData.licenses,
    stored: stored.licenses,
    // A licence number is unique per state, so a row duplicating another's is refused. Shared
    // with the step that badges the row, for the reason `serviceIsWritable` is.
    isWritable: (row) => licenseIsWritable(row, duplicates),
    body: toLicense,
    create: (body) => actions.createLicense(body),
    update: (body, serverId, version) =>
      actions.updateLicense(serverId, { version, ...body }),
    remove: (serverId) => actions.deleteLicense(serverId),
  });

  // Whether it worked or not, what landed is handed back — see `SyncedList.failure`.
  const applied = {
    formData: { ...formData, licenses: saved.rows },
    stored: { ...stored, licenses: saved.list },
  };

  return sent(
    saved.wrote,
    saved.failure === undefined
      ? {
          ok: true,
          ...applied,
          // Only on the way out — see the same line in `saveTradesAndServices`.
          ...(options.leaving === true && saved.held
            ? { deferred: "licenses-incomplete" as const }
            : {}),
        }
      : { ok: false, failure: saved.failure, ...applied }
  );
}

// --- The list diff ---------------------------------------------------------

interface SyncSpec<Row extends ServerRow, Wire extends { id: string; version: number }, Body extends object> {
  rows: Row[];
  stored: StoredList;
  isWritable: (row: Row) => boolean;
  /**
   * The request body, which is also what an unchanged row is recognised by.
   *
   * Built once per row and handed to both `create` and `update`: building it separately in
   * each would require the two to produce byte-identical JSON, or the `bodies` bookkeeping
   * stops matching and every save rewrites every row.
   *
   * Serialised through `contentOf`, the same function `fromWire.storedList` runs over the rows
   * it restores, so the two ends of that comparison cannot spell a body differently.
   */
  body: (row: Row) => Body;
  create: (body: Body) => Promise<ApiResult<Wire>>;
  update: (body: Body, serverId: string, version: number) => Promise<ApiResult<Wire>>;
  remove: (serverId: string) => Promise<ApiResult<void>>;
}

/** What `syncList` settled, including what has to be recorded when it did not finish. */
interface SyncedList<Row> {
  /** Every row, in form order, carrying whatever the server settled for the ones it took. */
  rows: Row[];
  /** The ids and bodies now known to be on the server, which is the next save's starting point. */
  list: StoredList;
  /**
   * Set when a row was refused. Everything written before it still landed, and `rows`/`list`
   * above say so — the caller has to record them even though the step failed.
   */
  failure?: ApiFailure;
  /** Whether any request was sent at all, which decides whether the dashboard needs busting. */
  wrote: boolean;
  /**
   * Whether any row was held back for being incomplete.
   *
   * Not a failure and not reported as one within the wizard — the row keeps its badge and its
   * place in the form. It is reported on the way out, because that is where a row that was
   * never written stops existing anywhere.
   */
  held: boolean;
}

/**
 * One list of rows brought into line with what the server holds.
 *
 * Three questions, answered in the order that keeps the list consistent if the step is
 * interrupted:
 *
 * 1. **What is gone?** Any stored id no row claims any more. Deleted first, so a name freed by
 *    a deletion is free by the time a rename or a new row tries to take it.
 * 2. **What changed?** A row whose body no longer matches the one recorded for its id. Rows
 *    that match are skipped entirely — every "Next" would otherwise rewrite every row and
 *    burn a version to store exactly what was already there.
 * 3. **What is new?** A row with no server id. It comes back with one, which is what stops the
 *    next save creating it a second time.
 *
 * The writes are sequential rather than parallel: the failure of any one of them aborts the
 * step, and a half-applied `Promise.all` would leave the form disagreeing with the server
 * about the rows whose calls happened to land.
 */
async function syncList<
  Row extends ServerRow,
  Wire extends { id: string; version: number },
  Body extends object,
>(
  spec: SyncSpec<Row, Wire, Body>
): Promise<SyncedList<Row>> {
  // Every row still in the form claims its id, complete or not. Writability decides whether a
  // row is written, never whether it is kept: a saved row blank for as long as it takes to
  // retype a field is somebody mid-edit, and deleting it here would take the stored row with
  // it. Only a row the user actually removed is gone from `spec.rows`.
  const claimed = new Set(spec.rows.map((row) => row.serverId).filter(Boolean));

  /**
   * Set the moment a request goes out, not when one succeeds: a refusal arriving after eight
   * rows landed leaves the dashboard as stale as a step that finished.
   */
  let wrote = false;

  // Concurrently, unlike the writes below: deletes carry no ordering among themselves, record
  // nothing per row, and tolerate a row that is already gone.
  const gone = spec.stored.ids.filter((id) => !claimed.has(id));

  if (gone.length > 0) {
    wrote = true;

    const removals = await Promise.all(gone.map((id) => spec.remove(id)));

    // A row already gone is the outcome asked for — see `isAlreadyGone`. Treating it as an
    // error would make the step permanently unrepeatable.
    const refused = removals.find((removed) => !removed.ok && !isAlreadyGone(removed.failure));

    if (refused !== undefined && !refused.ok) {
      // Handed back rather than thrown. Throwing would unwind past everything the caller had
      // recorded, so a trades write that had already landed would be reported as having sent
      // nothing and the dashboard left stale behind it. Nothing after this point has been
      // attempted, so what the server holds is still exactly `spec.stored`.
      return { rows: spec.rows, list: spec.stored, failure: refused.failure, wrote, held: false };
    }
  }

  const rows: Row[] = [];
  const ids: string[] = [];
  const bodies: Record<string, string> = {};
  let failure: ApiFailure | undefined;
  let held = false;

  /**
   * A row the server still holds, recorded as whatever body it last confirmed — not as the body
   * the row has now, since nothing was sent for it and claiming otherwise would make the next
   * save skip the write that is owed. An id with no confirmed body is left out of `bodies`,
   * which compares unequal to anything and so errs towards writing.
   */
  const keepAsStored = (row: Row) => {
    rows.push(row);
    if (row.serverId === undefined) return;

    ids.push(row.serverId);
    const confirmed = spec.stored.bodies[row.serverId];
    if (confirmed !== undefined) bodies[row.serverId] = confirmed;
  };

  for (const row of spec.rows) {
    // Once one row has been refused the rest are left untouched, and the list is handed back
    // with what did land recorded on it. Throwing out of here instead loses the server ids of
    // the rows created moments earlier, so the retry creates them a second time.
    if (failure !== undefined) {
      keepAsStored(row);
      continue;
    }

    // An incomplete row is somebody mid-thought, not something to write and not something to
    // throw away on their behalf.
    if (!spec.isWritable(row)) {
      held = true;
      keepAsStored(row);
      continue;
    }

    const sent = spec.body(row);
    const body = contentOf(sent);

    if (row.serverId === undefined) {
      const created = await spec.create(sent);
      wrote = true;

      if (!created.ok) {
        failure = created.failure;
        rows.push(row);
        continue;
      }

      rows.push({ ...row, serverId: created.data.id, version: created.data.version });
      ids.push(created.data.id);
      bodies[created.data.id] = body;
      continue;
    }

    if (spec.stored.bodies[row.serverId] === body) {
      keepAsStored(row);
      continue;
    }

    const updated = await spec.update(sent, row.serverId, row.version ?? 0);
    wrote = true;

    if (!updated.ok) {
      failure = updated.failure;
      keepAsStored(row);
      continue;
    }

    rows.push({ ...row, version: updated.data.version });
    ids.push(row.serverId);
    bodies[row.serverId] = body;
  }

  return { rows, list: { ids, bodies }, failure, wrote, held };
}

// --- What has not reached the server ---------------------------------------

/**
 * Whether anything on the form has not been written.
 *
 * The same question every `save*` above answers before it sends, asked without sending
 * anything. It exists for the one moment the wizard cannot save its way out of — a tab being
 * closed — where nothing asynchronous is allowed to run and all that is left is to decide
 * whether the browser's own prompt is warranted.
 *
 * Erring towards yes: a prompt nobody needed costs a keystroke, and the other mistake costs
 * whatever was typed. An untouched row somebody added and never filled in therefore counts,
 * because it exists nowhere but here.
 */
export function hasUnwrittenAnswers(formData: ProfileFormData, stored: StoredState): boolean {
  /** Before the first write there is no stored body, so the question is whether it is still blank. */
  const differs = (now: string, was: string | null, untouched: string) =>
    was === null ? now !== untouched : now !== was;

  return (
    differs(contentOf(toCreateBusiness(formData.profile)), stored.profileBody, UNTOUCHED.profile) ||
    differs(contentOf(toTrades(formData.trades)), stored.tradesBody, UNTOUCHED.trades) ||
    differs(contentOf(toPricing(formData.pricing, null)), stored.pricingBody, UNTOUCHED.pricing) ||
    differs(
      contentOf(toWorkingHours(formData.workingHours)),
      stored.workingHoursBody,
      UNTOUCHED.workingHours
    ) ||
    differs(
      contentOf(toBookingPolicy(formData.bookingPolicy, 0)),
      stored.bookingPolicyBody,
      UNTOUCHED.bookingPolicy
    ) ||
    listDiffers(formData.services, stored.services, toService) ||
    listDiffers(formData.licenses, stored.licenses, toLicense)
  );
}

/**
 * The same for one of the two lists: a row that is new, one whose body has moved on, one the
 * server still holds that no row claims any more, or the same rows in a different order.
 */
function listDiffers<Row extends ServerRow>(
  rows: Row[],
  stored: StoredList,
  body: (row: Row) => object
): boolean {
  const claimed = rows.map((row) => row.serverId).filter((id): id is string => id !== undefined);

  return (
    claimed.length !== rows.length ||
    !sameOrder(claimed, stored.ids) ||
    rows.some((row) => stored.bodies[row.serverId as string] !== contentOf(body(row)))
  );
}
