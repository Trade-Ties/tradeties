import { BOOKING_HORIZON_MAX, BOOKING_HORIZON_MIN } from "./limits";
import { digitsOnly } from "./digits";
import { slugify } from "./slug";
import { toE164 } from "./phone";
import type {
  BookingPolicyInput,
  BusinessTradesRequest,
  Coordinates,
  CreateBusinessRequest,
  LicenseInput,
  PricingInput,
  ServiceInput,
  UpdateBusinessRequest,
  WorkingHours,
} from "@/lib/api/wire";
import type {
  BookingPolicyForm,
  LicenseForm,
  PricingForm,
  ProfileForm,
  ServiceForm,
  TradesForm,
  WorkingHoursForm,
} from "./types";

/**
 * The form as the API takes it.
 *
 * The form carries the contract's own names, groupings and enum values, so nearly every field
 * goes over untouched. What is left below is where a form cannot hold what the wire wants.
 *
 * Nothing is validated here: the contract's rules belong to the server that owns them, and a
 * second set in this file would be a second set to keep in step.
 *
 * Two rules are worth naming, because breaking them fails at the database rather than at the
 * schema: a mode owns its fields — `PER_MILE` must arrive with the flat fee cleared, not merely
 * ignored — and a quote-only service must not carry a price. In both cases the form
 * deliberately remembers what was typed under the other setting.
 */

/**
 * A body as it is compared, rather than as it is sent: the same fields, without the version.
 *
 * A version moves every time the resource is stored, so comparing it would make a step nobody
 * has touched look changed the moment the step before it was written. What is left is the
 * answers, in the order the mappers below write them, which is what makes two comparable.
 *
 * Used for the three steps that are one resource; `StoredList.bodies` is the same idea for the
 * two that are lists.
 */
export function contentOf(body: object): string {
  const content = { ...body } as { version?: number };
  delete content.version;

  return JSON.stringify(content);
}

// --- Scalars ---------------------------------------------------------------

/**
 * A typed amount as `MoneyAmount` takes it, or null for one left blank.
 *
 * Amounts are text in the form so a decimal point can be typed at all, which means the form also
 * holds the half-typed states — "85." and ".5". Neither matches the contract's pattern and both
 * are somebody mid-keystroke rather than making a claim, so they are tidied here.
 *
 * A second point is not one of those, and this is the one thing tidying must not be trusted with:
 * `decimalOnly` lets every dot through, and the split below keeps the first two parts, so "85.5.5"
 * would go over as 85.5 and be accepted while every screen went on showing what was typed.
 * `moneyProblem` names it and the writability checks hold the row or the step back, so nothing
 * spelling it reaches this function.
 */
function money(value: string): string | null {
  const [whole = "", fraction] = value.trim().split(".");
  const digits = digitsOnly(whole);
  const decimals = digitsOnly(fraction ?? "").slice(0, 4);

  if (digits === "" && decimals === "") return null;

  return decimals === "" ? digits || "0" : `${digits || "0"}.${decimals}`;
}

/**
 * Whether a box states an amount at all, which is not the question of whether it is empty.
 *
 * `decimalOnly` lets a bare "." through, and `money` finds no digits in it and sends null — so
 * an "is this filled in" test asking `trim() === ""` says yes to a box the wire reads as blank.
 * Each such gap is a 400 for a whole step: a required price arriving as null, a travel fee a mode
 * demands, a call-out fee waived when the server can see no fee to waive. The publish review has
 * the same gap the other way, printing "$." for an amount nothing stores.
 *
 * Asked of `money` itself rather than of the string, because the two have to agree exactly. A
 * second reading of what counts as an amount is the one that drifts — "..5" carries a digit and
 * is still nothing `money` will send.
 */
export const statesAnAmount = (value: string): boolean => money(value) !== null;

/** The same, for the one amount the contract requires — a blank cancellation fee is no fee. */
const requiredMoney = (value: string): string => money(value) ?? "0";

/** A percentage as `PercentAmount` takes it: two decimals where money allows four. */
function percent(value: string): string | null {
  const amount = money(value);
  if (amount === null) return null;

  const [whole, fraction] = amount.split(".");
  return fraction === undefined ? whole : `${whole}.${fraction.slice(0, 2)}`;
}

/** Trimmed, or null where the contract wants "not stated" rather than an empty string. */
const optional = (value: string): string | null => value.trim() || null;

/** A whole number, or null for a box left empty — "no cap" rather than a cap of zero. */
function count(value: string): number | null {
  const digits = digitsOnly(value);
  return digits === "" ? null : Number(digits);
}

/**
 * A cap on the day, where zero means the same as an empty box.
 *
 * `maxAcceptedAppointmentsPerDay` is `minimum: 1`, so a typed `0` is not a cap the contract has
 * — it is a 400 for the whole availability step, after the working-hours write has landed.
 * Nobody types `0` there meaning "refuse every job"; they mean what the contract spells `null`.
 */
function cap(value: string): number | null {
  const parsed = count(value);
  return parsed === null || parsed < 1 ? null : parsed;
}

/**
 * The booking horizon, held to the contract's `1..730`.
 *
 * Unlike `count` this field has no "not stated" — the column is `NOT NULL` — so an empty box
 * has to become a number here. The floor repeats the one the field applies on blur, because
 * Next is reachable from the keyboard without the box ever losing focus.
 */
function horizon(value: string): number {
  const digits = digitsOnly(value);

  return digits === ""
    ? BOOKING_HORIZON_MIN
    : Math.min(BOOKING_HORIZON_MAX, Math.max(BOOKING_HORIZON_MIN, Number(digits)));
}

/**
 * A website as the contract's pattern takes it. A scheme is added where one is missing rather
 * than the address being refused: what people type is "joesplumbing.com".
 */
function websiteUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const scheme = /^(https?):\/\//i.exec(trimmed);
  if (scheme === null) return `https://${trimmed}`;

  // Recognised in any case and sent in one: the contract's pattern is `^https?://.+` compiled
  // without a case-insensitive flag, so an "HTTP://…" pasted from a browser bar is refused with
  // "Invalid request content." for the whole Business step. Only the scheme is lowercased —
  // case matters in a path.
  return `${scheme[1].toLowerCase()}${trimmed.slice(scheme[1].length)}`;
}

// --- Onboarding steps 1 and 2 — the profile --------------------------------

/**
 * Everything steps 1 and 2 answer, which the contract submits as a single body. Not splittable:
 * the address, the time zone and the radius are all mandatory, so nothing is persistable until
 * step 2 is complete — which is why the wizard puts both on one screen.
 */
function businessBody(p: ProfileForm) {
  return {
    // The strict form, for the same reason `money` exists above: the field keeps a trailing
    // hyphen while somebody is typing one, and "joes-" is not a claim the contract accepts.
    slug: slugify(p.slug),
    legalName: p.legalName.trim(),
    displayName: p.displayName.trim(),
    description: optional(p.description),
    websiteUrl: websiteUrl(p.websiteUrl),
    phone: toE164(p.phone),
    email: p.email.trim(),
    address: {
      street1: p.address.street1.trim(),
      street2: optional(p.address.street2),
      city: p.address.city.trim(),
      state: p.address.state,
      postalCode: p.address.postalCode.trim(),
    },
    timeZone: p.timeZone,
    serviceRadiusMiles: p.serviceRadiusMiles,
  };
}

export function toCreateBusiness(profile: ProfileForm): CreateBusinessRequest {
  return businessBody(profile);
}

/**
 * The profile as a replacement of what is stored.
 *
 * `timeZoneChangeConfirmed` is stated on every update rather than spread in when true. The flag
 * means "yes, move my calendar", so `false` is the honest default; the server reads it only
 * when the zone differs and the business has working hours, and the wizard sets it after asking.
 */
export function toUpdateBusiness(
  profile: ProfileForm,
  version: number,
  /**
   * Where the address geocoded to, echoed back rather than resent as nothing.
   *
   * The update is a full replacement and the controller reads `coordinates` off the request, so
   * a body that leaves it out stores null. Nobody types this and no screen shows it, which is
   * exactly why it has to be carried: the wizard would otherwise undo a geocode on every save
   * of steps 1 and 2, silently and forever. See `StoredState.coordinates`.
   */
  coordinates: Coordinates | null,
  timeZoneChangeConfirmed = false
): UpdateBusinessRequest {
  return { version, ...businessBody(profile), coordinates, timeZoneChangeConfirmed };
}

// --- Onboarding step 3 — trades --------------------------------------------

export function toTrades(t: TradesForm): BusinessTradesRequest {
  return {
    primaryTradeId: t.primaryTradeId,
    // The contract refuses the primary repeated here. `TradeStep` already keeps it out; this
    // is the second lock, because a resumed form is assembled somewhere else entirely.
    additionalTradeIds: t.additionalTradeIds.filter((id) => id !== t.primaryTradeId),
  };
}

// --- Onboarding step 4 — services ------------------------------------------

export function toService(s: ServiceForm): ServiceInput {
  return {
    tradeId: s.tradeId,
    name: s.name.trim(),
    description: optional(s.description),
    estimatedDurationMinutes: s.estimatedDurationMinutes,
    pricingMode: s.pricingMode,
    // "Not before I have seen it" cannot arrive with a number attached.
    price: s.pricingMode === "QUOTE_ONLY" ? null : money(s.price),
    active: true,
  };
}

// --- Onboarding step 5 — rates and terms -----------------------------------

export function toPricing(p: PricingForm, version: number | null): PricingInput {
  return {
    // Omitted on the first write, per the contract: sending null would be a claim about a
    // version rather than the absence of one, and either statement being wrong is a 409.
    ...(version === null ? {} : { version }),
    hourlyRate: money(p.hourlyRate),
    minimumBillableMinutes: p.minimumBillableMinutes,
    billingIncrementMinutes: p.billingIncrementMinutes,
    serviceCallFee: money(p.serviceCallFee),
    serviceCallFeeWaivedIfHired: p.serviceCallFeeWaivedIfHired,
    // Each mode clears the fields the other two own — see the note at the top of this file.
    travelFeeMode: p.travelFeeMode,
    travelFlatFee: p.travelFeeMode === "FLAT" ? money(p.travelFlatFee) : null,
    travelRatePerMile: p.travelFeeMode === "PER_MILE" ? money(p.travelRatePerMile) : null,
    // Sent under every mode that charges for travel, which is what the step offers it under.
    // Unlike the two fees above the contract does not tie this field to a mode, so restricting
    // it to `PER_MILE` would silently drop a figure typed under `FLAT`.
    freeTravelRadiusMiles:
      p.travelFeeMode === "INCLUDED" ? null : count(p.freeTravelRadiusMiles),
    materialPricingMode: p.materialPricingMode,
    materialMarkupPercent:
      p.materialPricingMode === "COST_PLUS_MARKUP" ? percent(p.materialMarkupPercent) : null,
    cancellationFee: requiredMoney(p.cancellationFee),
    cancellationNoticeHours: p.cancellationNoticeHours,
  };
}

// --- Onboarding step 6 — licences ------------------------------------------

export function toLicense(l: LicenseForm): LicenseInput {
  return {
    state: l.state,
    licenseNumber: l.licenseNumber.trim(),
    licenseType: optional(l.licenseType),
    issuedOn: optional(l.issuedOn),
    expiresOn: optional(l.expiresOn),
  };
}

// --- Onboarding step 7 — the working week ----------------------------------

/**
 * The week, which the form already holds in the contract's order. All that happens here is that
 * `open` is spent: the contract says "closed" with an empty list, and this is where the form's
 * memory of the hours behind a closed day stops travelling.
 */
export function toWorkingHours(week: WorkingHoursForm): WorkingHours {
  return {
    days: week.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      blocks: day.open
        ? day.blocks.map((block) => ({ startsAt: block.startsAt, endsAt: block.endsAt }))
        : [],
    })),
  };
}

// --- Onboarding step 8 — booking rules -------------------------------------

export function toBookingPolicy(b: BookingPolicyForm, version: number): BookingPolicyInput {
  return {
    version,
    bookingHorizonDays: horizon(b.bookingHorizonDays),
    minLeadTimeHours: b.minLeadTimeHours,
    maxAcceptedAppointmentsPerDay: cap(b.maxAcceptedAppointmentsPerDay),
    slotGranularityMinutes: b.slotGranularityMinutes,
    appointmentBufferMinutes: b.appointmentBufferMinutes,
  };
}
