import { toMinutes } from "./constants";
import { digitsOnly } from "./digits";
import { isInternational, nationalDigits } from "./phone";
import { statesAnAmount } from "./toWire";
import { isComplete as isCompletePostalCode } from "./postalCode";
import type {
  LicenseForm,
  PricingForm,
  ProfileForm,
  ServiceForm,
  TimeBlockForm,
  TradesForm,
  WorkingHoursForm,
} from "./types";

/**
 * Whether what somebody has typed is the shape the contract wants.
 *
 * Shape only. Whether a field is filled in at all is asked once, at the end, by `review.ts`.
 * Every function here therefore answers `undefined` for an empty value: an empty box has no
 * format to be wrong about.
 *
 * Stated here as well as on the server because a bean-validation failure comes back as one
 * sentence — "Invalid request content." — for a body with twelve constrained fields in it. The
 * server still enforces every rule; this exists to name the field where the field is.
 *
 * Nothing here is stricter than the contract except where it is noted, and nothing here is a
 * rule the contract does not have. A check invented on this side is a rule that drifts.
 */

/** What is wrong with one field, or `undefined` when nothing is. */
export type FieldProblem = string | undefined;

/**
 * A US number needs its full ten digits.
 *
 * Stricter than the contract's `^\+[1-9]\d{1,14}$` deliberately: `toE164` turns anything short
 * into a shorter `+…`, so "(303) 555-01" becomes `+30355501`, which satisfies E.164 and is
 * nobody's telephone. The wire pattern has to accept every country; this field knows it is US.
 */
export function phoneProblem(value: string): FieldProblem {
  if (value.trim() === "") return undefined;

  // A number stating its own country code is not this field's to second-guess: nothing here
  // shortens it, so the contract's pattern is the whole rule. A restored profile can hold one,
  // and calling it a bad US number would hold its owner on the Business step for good.
  if (isInternational(value)) {
    return /^\+[1-9]\d{1,14}$/.test(value.trim())
      ? undefined
      : "That does not look like a phone number.";
  }

  return nationalDigits(value) === null ? "A US number has ten digits." : undefined;
}

/**
 * Slightly stricter than the server, which uses the default Jakarta `@Email` and would take
 * `joe@acme` without a dot in it. For a business contact address printed on a public profile,
 * a missing top-level domain is a typo rather than an intranet address.
 */
export function emailProblem(value: string): FieldProblem {
  if (value.trim() === "") return undefined;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? undefined
    : "That does not look like an email address.";
}

/**
 * The contract's own shape, asked of the module that also produces it — see `postalCode.ts`
 * for why the two live together, and `phoneProblem` above for the same arrangement.
 */
export function postalCodeProblem(value: string): FieldProblem {
  if (value.trim() === "") return undefined;

  return isCompletePostalCode(value) ? undefined : "A ZIP code has five digits.";
}

// --- Amounts ---------------------------------------------------------------

/**
 * The digits before the decimal point, which is the only part of an amount a form can get
 * irreversibly wrong. `toWire`'s `money` tidies everything else on the way out, but nothing can
 * shorten the whole part without storing a different amount.
 */
const wholeDigits = (value: string) => digitsOnly(value.trim().split(".")[0]);

/**
 * A second decimal point, which `decimalOnly` lets through and nothing below this refuses.
 *
 * `toWire`'s `money` reads the first two parts of the split and drops the rest, so "85.5.5" goes
 * over as 85.5 and is accepted — while the box, the service row and the publish review all go on
 * showing what was typed. Named here because nothing else refuses it: the rule is the contract's
 * own pattern, and a pattern failure comes back with no field attached.
 *
 * Not the only place a typed figure is shortened — `money` also cuts a fifth decimal — but the
 * only one where what is dropped changes the amount. A fifth decimal is below what
 * `NUMERIC(19,4)` can hold either way.
 */
const hasSecondPoint = (value: string) => value.indexOf(".") !== value.lastIndexOf(".");

const TOO_MANY_POINTS = "An amount takes one decimal point at most.";


/**
 * `MoneyAmount` is `^\d{1,15}(\.\d{1,4})?$` — fifteen digits before the point, which is the
 * `NUMERIC(19,4)` column.
 *
 * The per-field magnitude ceilings — $2,000 an hour, $50 a mile — are deliberately not here:
 * the server answers those by naming both the amount and the ceiling that refused it. Only the
 * pattern is restated, because a pattern failure comes back with no field attached.
 */
export function moneyProblem(value: string): FieldProblem {
  if (value.trim() === "") return undefined;
  if (hasSecondPoint(value)) return TOO_MANY_POINTS;

  return wholeDigits(value).length > 15 ? "That is more than an amount can hold." : undefined;
}

/** `PercentAmount` is `^\d{1,3}(\.\d{1,2})?$` — `NUMERIC(5,2)`, so 999.99 is the ceiling. */
export function percentProblem(value: string): FieldProblem {
  if (value.trim() === "") return undefined;
  if (hasSecondPoint(value)) return TOO_MANY_POINTS;

  return wholeDigits(value).length > 3 ? "999.99% is the most that can be stored." : undefined;
}

// --- Onboarding step 3 — trades --------------------------------------------

/**
 * The trades a service may be filed under, the primary one first — which is also the order the
 * dropdown offers them in and so which one a new row starts with.
 *
 * Empty until a primary is chosen, and that is the part worth stating. `saveTradesAndServices`
 * skips step 3 entirely without a primary, so until there is one the server holds no trades at
 * all, and a service naming one it cannot see is a 400 for the whole step.
 *
 * One list, read by the step that offers it, the step that badges a row against it and the save
 * that decides from it what may be sent.
 */
export const claimedTradeIds = (trades: TradesForm): string[] =>
  trades.primaryTradeId === "" ? [] : [trades.primaryTradeId, ...trades.additionalTradeIds];

// --- Onboarding step 4 — services ------------------------------------------

/**
 * Whether a service still owes a price. `FLAT` and `STARTING_AT` are the two modes the contract
 * says need one; `HOURLY` falls back to the general rate and `QUOTE_ONLY` has no price box.
 *
 * Here rather than in the step because `save.ts` decides from the same question whether a row
 * can be written. Two copies disagreeing sends a row the screen has already badged.
 */
export function serviceNeedsPrice(service: ServiceForm): boolean {
  return (
    service.pricingMode !== "QUOTE_ONLY" &&
    service.pricingMode !== "HOURLY" &&
    !statesAnAmount(service.price)
  );
}

/**
 * What is wrong with the price a service actually states, or undefined when it states none that
 * is sent.
 *
 * `toWire` clears the amount of a `QUOTE_ONLY` service, so a figure left behind under a mode
 * since switched away from is not this row's claim and must not hold it back.
 *
 * Asked of `serviceIsWritable` as well as of the box, for the reason `serviceNeedsPrice` is: a
 * pattern failure comes back as a 400 whose whole message is "Invalid request content.", naming
 * neither the field nor the row, and `syncList` leaves every service behind it unwritten.
 */
export const servicePriceProblem = (service: ServiceForm): FieldProblem =>
  service.pricingMode === "QUOTE_ONLY" ? undefined : moneyProblem(service.price);

/**
 * Whether a service is still filed under a trade the business has stopped claiming.
 *
 * One spelling, read by the step that badges the row and by the save that acts on it — for the
 * reason this module's header gives. A row with no trade at all is a different state: incomplete
 * rather than orphaned, and said differently.
 */
export const serviceTradeIsGone = (
  service: ServiceForm,
  claimed: ReadonlySet<string>
): boolean => service.tradeId !== "" && !claimed.has(service.tradeId);

/**
 * Whatever more than one row is claiming, which is a question about the list rather than about
 * any row in it.
 *
 * `keyOf` answers `null` for a row not claiming anything yet — a service with no name, a
 * licence with no number — because a half-filled row cannot be the second claim on something.
 */
function duplicateKeys<Row>(rows: Row[], keyOf: (row: Row) => string | null): Set<string> {
  const seen = new Map<string, number>();

  for (const row of rows) {
    const key = keyOf(row);
    if (key !== null) seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  return new Set([...seen].filter(([, count]) => count > 1).map(([key]) => key));
}

/**
 * How two service names are compared for the uniqueness the server enforces. `service_by_name`
 * is per business and case-insensitive, and the server trims before it stores, so
 * "Clog removal" and " clog removal " are the same claim.
 */
export const serviceNameKey = (service: ServiceForm): string | null =>
  service.name.trim().toLowerCase() || null;

export const duplicateServiceNames = (services: ServiceForm[]): Set<string> =>
  duplicateKeys(services, serviceNameKey);

/**
 * A licence is identified by its number within the issuing state, so that pair is what can
 * clash — the same number in two states is two different licences.
 *
 * Compared exactly, unlike a service name, and the difference is the schema's rather than this
 * file's: `business_license_uidx` is `(business_id, state, license_number)` with no `lower()`
 * where `business_service_by_name_uidx` has one. Folding case together here would be a rule the
 * contract does not have — and an expensive one, because neither of two rows this calls a
 * duplicate is ever written, so two licences differing only in case would both be held back for
 * good with nothing on the server disagreeing.
 */
export const licenseKey = (license: LicenseForm): string | null =>
  license.state === "" || license.licenseNumber.trim() === ""
    ? null
    : `${license.state}:${license.licenseNumber.trim()}`;

export const duplicateLicenseKeys = (licenses: LicenseForm[]): Set<string> =>
  duplicateKeys(licenses, licenseKey);

/**
 * Everything a service row owes before it is worth sending, including that its name is free.
 *
 * The duplicate set is passed in because it is a property of the list, not of the row. Neither
 * of two clashing rows is written, rather than whichever the loop reaches first: both are
 * badged on screen, so what is refused and what the screen calls wrong stay the same thing.
 *
 * The trade is here for the same reason, and it is asked twice. A row added before step 3 was
 * answered has nothing to be filed under, and the contract makes `tradeId` required; a row still
 * naming a trade the business has since given up is refused by the composite foreign key, which
 * comes back as a 400 about the whole step rather than about the row.
 */
export function serviceIsWritable(
  service: ServiceForm,
  duplicates: ReadonlySet<string>,
  claimed: ReadonlySet<string>
): boolean {
  const key = serviceNameKey(service);

  return (
    key !== null &&
    service.tradeId !== "" &&
    claimed.has(service.tradeId) &&
    !serviceNeedsPrice(service) &&
    servicePriceProblem(service) === undefined &&
    !duplicates.has(key)
  );
}

/**
 * What a service row is badged with, or null when it owes nothing. Beside `serviceIsWritable`
 * for the reason `licenseProblem` sits beside `licenseIsWritable`: the two read the same
 * answers, and the order they are asked in is the badge — the first thing wrong is the thing to
 * say.
 *
 * Held together deliberately. A condition added to the predicate and not to this would make
 * `syncList` skip the row with no badge, no error and nothing on screen disagreeing.
 */
export function serviceProblem(
  service: ServiceForm,
  duplicates: ReadonlySet<string>,
  claimed: ReadonlySet<string>
): string | null {
  const key = serviceNameKey(service);

  if (key !== null && duplicates.has(key)) return "Duplicate name";
  if (key === null) return "Needs a name";
  if (service.tradeId === "") return "Needs a trade";
  if (serviceTradeIsGone(service, claimed)) return "Trade removed";
  if (serviceNeedsPrice(service)) return "Needs a price";
  if (servicePriceProblem(service) !== undefined) return "Check the price";

  return null;
}

// --- Onboarding step 7 — the working week ----------------------------------

/**
 * The blocks on one day that run into another, by key.
 *
 * A set rather than a boolean because the step badges the ranges themselves, and both sides of
 * an overlap are marked: neither is more wrong than the other.
 *
 * Half-open, so `09:00–12:00` and `12:00–17:00` are two ranges rather than one clash — which is
 * how the contract reads them and how anybody writing them means them.
 */
export function overlappingBlockKeys(blocks: TimeBlockForm[]): Set<number> {
  const bad = new Set<number>();

  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];

      if (
        toMinutes(a.startsAt) < toMinutes(b.endsAt) &&
        toMinutes(b.startsAt) < toMinutes(a.endsAt)
      ) {
        bad.add(a.key);
        bad.add(b.key);
      }
    }
  }

  return bad;
}

/**
 * Whether the week can be sent, which is the question every other step asks here too.
 *
 * `CalendarService.requireCoherent` refuses the whole week over a single overlap, and by the
 * time it answers the wizard has moved on — so the message lands on a screen that has nothing
 * to do with it. Asked on this side, the step is deferred and says so where the ranges are.
 */
export const workingHoursAreWritable = (week: WorkingHoursForm): boolean =>
  week.every((day) => overlappingBlockKeys(day.blocks).size === 0);

// --- Onboarding step 5 — rates and terms -----------------------------------

/**
 * The amounts a mode on the Pricing step cannot be stored without, each under the label its field
 * carries on screen.
 *
 * The contract cannot express these: `travelFlatFee` is `oneOf [MoneyAmount, null]` whatever the
 * mode says, so an empty box goes over as a legal `null` and `PricingService.requireCoherent`
 * refuses the whole body — "A flat travel fee needs an amount" — on a screen the wizard has
 * already moved off.
 */
const REQUIRED_BY_MODE: { label: string; owed: (pricing: PricingForm) => boolean }[] = [
  {
    label: "Flat travel rate",
    owed: (p) => p.travelFeeMode === "FLAT" && !statesAnAmount(p.travelFlatFee),
  },
  {
    label: "Rate per mile",
    owed: (p) => p.travelFeeMode === "PER_MILE" && !statesAnAmount(p.travelRatePerMile),
  },
  {
    label: "Markup",
    owed: (p) =>
      p.materialPricingMode === "COST_PLUS_MARKUP" && !statesAnAmount(p.materialMarkupPercent),
  },
];

/** Which of them are still empty, in the order the screen asks them. */
export const missingPricingFields = (pricing: PricingForm): string[] =>
  REQUIRED_BY_MODE.filter(({ owed }) => owed(pricing)).map(({ label }) => label);

/**
 * The amounts this screen actually sends, which is not every amount it holds.
 *
 * `toPricing` clears the fields a mode does not own, and the form deliberately keeps what was
 * typed under the other two so that switching back restores it. Checking those as well would let
 * a malformed figure left behind under a mode nobody can see hold the whole step back — with no
 * box on screen to clear it, and a notice pointing at a field that is not there.
 */
const amountsSent = (p: PricingForm): string[] => [
  p.hourlyRate,
  p.serviceCallFee,
  p.cancellationFee,
  p.travelFeeMode === "FLAT" ? p.travelFlatFee : "",
  p.travelFeeMode === "PER_MILE" ? p.travelRatePerMile : "",
];

/**
 * Whether the rates can be sent at all.
 *
 * All or nothing, as steps 1 and 2 are: one incoherent amount is a 400 about the whole body, so
 * the step waits for the box to be put right rather than being sent to be refused as a whole.
 *
 * The last clause is `requireCoherent`'s fourth rule — "Waiving a service call fee that does not
 * exist is not a statement". The step keeps the tick box and the fee in step as they are edited;
 * this is the second lock, because a resumed form is assembled somewhere else entirely.
 */
export function pricingIsWritable(pricing: PricingForm): boolean {
  return (
    missingPricingFields(pricing).length === 0 &&
    amountsSent(pricing).every((amount) => moneyProblem(amount) === undefined) &&
    (pricing.materialPricingMode !== "COST_PLUS_MARKUP" ||
      percentProblem(pricing.materialMarkupPercent) === undefined) &&
    !(pricing.serviceCallFeeWaivedIfHired && !statesAnAmount(pricing.serviceCallFee))
  );
}

// --- Onboarding step 6 — licences ------------------------------------------

/**
 * Whether a licence claims to have expired before it was issued.
 *
 * A rule comparing two fields, so the contract cannot express it as a `@Pattern`;
 * `LicenseService.requireSaneDates` states it on the server. Stated here as well so the row is
 * held back rather than sent to be refused.
 *
 * The dates are `yyyy-mm-dd`, where a string comparison is a date comparison.
 */
export function licenseDatesAreBackwards(license: LicenseForm): boolean {
  return (
    license.issuedOn !== "" && license.expiresOn !== "" && license.expiresOn < license.issuedOn
  );
}

/**
 * Everything a licence row owes before it is worth sending. Here beside the service predicate
 * rather than inline in `save.ts`, because the step badges the row from these same answers.
 */
export function licenseIsWritable(
  license: LicenseForm,
  duplicates: ReadonlySet<string>
): boolean {
  const key = licenseKey(license);

  return key !== null && !licenseDatesAreBackwards(license) && !duplicates.has(key);
}

/**
 * What a licence row is badged with, or null when it owes nothing. Beside `licenseIsWritable`
 * because the two read the same answers, and the order they are asked in is the badge: the
 * first thing wrong is the thing to say.
 */
export function licenseProblem(
  license: LicenseForm,
  duplicates: ReadonlySet<string>,
  today: string
): string | null {
  if (duplicates.has(licenseKey(license) ?? "")) return "Duplicate";
  if (license.state === "") return "Needs a state";
  if (license.licenseNumber.trim() === "") return "Needs a number";
  if (licenseDatesAreBackwards(license)) return "Check the dates";

  // `today` is empty until the client has settled on a date — see the step, which reads it
  // through `useSyncExternalStore` so the server and the first client render agree.
  if (today !== "" && license.expiresOn !== "" && license.expiresOn < today) return "Expired";

  return null;
}

/**
 * Everything `business_profile` declares `NOT NULL`, each under the label its field carries on
 * screen. One list, read both to decide whether the step can be written and to say what it is
 * still waiting for.
 *
 * The slug is in the list although nobody types it: it is proposed from the display name, so it
 * is empty exactly while the display name is, and sending an empty one is a 400 about a field
 * the person never saw.
 */
export type RequiredProfileField =
  | "legalName"
  | "displayName"
  | "slug"
  | "email"
  | "phone"
  | "address"
  | "timeZone";

const REQUIRED_BEFORE_WRITING: {
  field: RequiredProfileField;
  label: string;
  read: (profile: ProfileForm) => string;
}[] = [
  { field: "legalName", label: "Legal name", read: (p) => p.legalName },
  { field: "displayName", label: "Display name", read: (p) => p.displayName },
  { field: "slug", label: "Profile URL", read: (p) => p.slug },
  { field: "email", label: "Email", read: (p) => p.email },
  { field: "phone", label: "Phone", read: (p) => p.phone },
  // Four boxes, one answer: the publish review shows the address as a single line, so the
  // parts share a field name even though each is asked for separately here.
  { field: "address", label: "Address", read: (p) => p.address.street1 },
  { field: "address", label: "City", read: (p) => p.address.city },
  { field: "address", label: "State", read: (p) => p.address.state },
  { field: "address", label: "ZIP code", read: (p) => p.address.postalCode },
  { field: "timeZone", label: "Time zone", read: (p) => p.timeZone },
];

/**
 * The same table, as the question the publish review asks of it. Shared so that which answers a
 * profile cannot exist without is decided once; the wording deliberately is not, because the
 * review's summary column phrases them differently.
 */
export const REQUIRED_PROFILE_FIELDS: ReadonlySet<RequiredProfileField> = new Set(
  REQUIRED_BEFORE_WRITING.map((entry) => entry.field)
);

/**
 * Which of those are still empty, in the order the screen asks them.
 *
 * The one thing a field cannot say for itself: an untouched empty box carries no error, and the
 * Business step's Next button is disabled until every one of them is filled.
 */
export function missingProfileFields(profile: ProfileForm): string[] {
  return REQUIRED_BEFORE_WRITING.filter(({ read }) => read(profile).trim() === "").map(
    ({ label }) => label
  );
}

/**
 * Which filled-in answers are in the wrong shape, under the same labels.
 *
 * The other half of `profileIsWritable`, and it has to be nameable for the same reason the first
 * half does. A field states its own format complaint — but only once it has been left behind, so
 * on a box nobody has blurred yet the Next button is grey and the field beside it is silent.
 */
export function misshapenProfileFields(profile: ProfileForm): string[] {
  return [
    { label: "Email", problem: emailProblem(profile.email) },
    { label: "Phone", problem: phoneProblem(profile.phone) },
    { label: "ZIP code", problem: postalCodeProblem(profile.address.postalCode) },
  ]
    .filter(({ problem }) => problem !== undefined)
    .map(({ label }) => label);
}

/**
 * Whether steps 1 and 2 can be sent at all.
 *
 * All or nothing: `business_profile` has the address, the time zone, the radius, the phone, the
 * email and both names as `NOT NULL`, so there is no half-stored profile — which is also why
 * the contract submits both steps as one body.
 *
 * Every other endpoint resolves the business from the token and answers 404 without one, so
 * this decides not just whether this step can be written but whether anything can be. That is
 * why the wizard holds the Business step until it is true.
 */
export function profileIsWritable(profile: ProfileForm): boolean {
  return (
    missingProfileFields(profile).length === 0 && misshapenProfileFields(profile).length === 0
  );
}
