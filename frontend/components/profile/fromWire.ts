import { CANCELLATION_POLICIES, blankForm } from "./constants";
import { fromE164 } from "./phone";
import {
  contentOf,
  toBookingPolicy,
  toCreateBusiness,
  toLicense,
  toPricing,
  toService,
  toTrades,
  toWorkingHours,
} from "./toWire";
import type { OnboardingSnapshot } from "@/lib/api/onboarding";
import type {
  BookingPolicy,
  BusinessProfile,
  BusinessTrades,
  License,
  Pricing,
  Service,
  WorkingHours,
} from "@/lib/api/wire";
import type {
  BookingPolicyForm,
  LicenseForm,
  PricingForm,
  ProfileForm,
  ProfileFormData,
  ServiceForm,
  StoredList,
  StoredState,
  TradesForm,
  UiState,
  WorkingHoursForm,
} from "./types";

/**
 * What is stored, as the form holds it — the mirror of `toWire`.
 *
 * Nothing here invents a value. Where the server has nothing stored, the corresponding slice of
 * a `blankForm()` is used unchanged, so an untouched step looks exactly as it does on a first
 * visit. A fresh one each time, because what is handed back is a form somebody is about to edit.
 */

// --- Scalars ---------------------------------------------------------------

/** A nullable string as the form holds one: always a string, empty for "not stated". */
const text = (value: string | null | undefined): string => value ?? "";

/** A nullable number as the form holds one — a text box, empty for "no cap". */
const digits = (value: number | null | undefined): string =>
  value === null || value === undefined ? "" : String(value);

/**
 * An amount as the form shows it, with the contract's trailing zeros taken off. The server
 * stores `NUMERIC(19,4)`, so "85" comes back as "85.0000" — which in an editable box invites a
 * correction, and re-saving it would be a write of a value that only looked different.
 */
function amount(value: string | null | undefined): string {
  if (!value) return "";

  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}

// --- Onboarding steps 1 and 2 — the profile --------------------------------

function toProfileForm(profile: BusinessProfile): ProfileForm {
  return {
    slug: profile.slug,
    legalName: profile.legalName,
    displayName: profile.displayName,
    description: text(profile.description),
    websiteUrl: text(profile.websiteUrl),
    phone: fromE164(profile.phone),
    email: profile.email,
    address: {
      street1: profile.address.street1,
      street2: text(profile.address.street2),
      city: profile.address.city,
      state: profile.address.state,
      postalCode: profile.address.postalCode,
    },
    timeZone: profile.timeZone,
    serviceRadiusMiles: profile.serviceRadiusMiles,
  };
}

// --- Onboarding step 3 — trades --------------------------------------------

/**
 * The trades, reduced back to the ids the form works in. `BusinessTrades` arrives resolved, as
 * whole `Trade` objects; the form stores ids and looks names up through `reference`, which is
 * the one place that knows what the catalogue currently says.
 */
function toTradesForm(trades: BusinessTrades | null): TradesForm {
  if (trades === null) return blankForm().trades;

  return {
    primaryTradeId: trades.primary?.id ?? "",
    additionalTradeIds: trades.additional.map((trade) => trade.id),
  };
}

// --- Onboarding step 4 — services ------------------------------------------

/**
 * The stored services as rows, keeping the server's id and version on each.
 *
 * `key` is the form's own counter, assigned by position: the list arrives in `sortOrder`, and
 * the counter means nothing outside this form.
 *
 * Deactivated services are left out. Deleting one an appointment points at deactivates it
 * rather than removing it, so a `GET` keeps returning it — and the order endpoint takes every
 * active service exactly once, so carrying a deactivated one back makes the next reorder a 400.
 * Dropping it here keeps it out of the bookkeeping too.
 */
function toServiceForms(services: Service[]): ServiceForm[] {
  return services
    .filter((service) => service.active)
    .map((service, index) => ({
      key: index + 1,
      serverId: service.id,
      version: service.version,
      tradeId: service.tradeId,
      name: service.name,
      description: text(service.description),
      estimatedDurationMinutes: service.estimatedDurationMinutes,
      pricingMode: service.pricingMode,
      price: amount(service.price),
    }));
}

// --- Onboarding step 5 — rates and terms -----------------------------------

function toPricingForm(pricing: Pricing | null): PricingForm {
  if (pricing === null) return blankForm().pricing;

  return {
    hourlyRate: amount(pricing.hourlyRate),
    minimumBillableMinutes: pricing.minimumBillableMinutes,
    billingIncrementMinutes: pricing.billingIncrementMinutes,
    serviceCallFee: amount(pricing.serviceCallFee),
    serviceCallFeeWaivedIfHired: pricing.serviceCallFeeWaivedIfHired,
    travelFeeMode: pricing.travelFeeMode,
    travelFlatFee: amount(pricing.travelFlatFee),
    travelRatePerMile: amount(pricing.travelRatePerMile),
    freeTravelRadiusMiles: digits(pricing.freeTravelRadiusMiles),
    materialPricingMode: pricing.materialPricingMode,
    materialMarkupPercent: amount(pricing.materialMarkupPercent),
    cancellationFee: amount(pricing.cancellationFee),
    cancellationNoticeHours: pricing.cancellationNoticeHours,
  };
}

// --- Onboarding step 6 — licences ------------------------------------------

function toLicenseForms(licenses: License[]): LicenseForm[] {
  return licenses.map((license, index) => ({
    key: index + 1,
    serverId: license.id,
    version: license.version,
    state: license.state,
    licenseNumber: license.licenseNumber,
    licenseType: text(license.licenseType),
    issuedOn: text(license.issuedOn),
    expiresOn: text(license.expiresOn),
  }));
}

// --- Onboarding step 7 — the working week ----------------------------------

/**
 * The week back into the form, with `open` derived rather than read: a day with no blocks is
 * the contract's way of saying closed. The one asymmetry is that a day coming back closed is
 * given the block an empty form would have, unopened, so switching it back on shows hours
 * rather than an empty panel.
 */
function toWorkingHoursForm(hours: WorkingHours | null): WorkingHoursForm {
  if (hours === null) return blankForm().workingHours;

  const stored = new Map(hours.days.map((day) => [day.dayOfWeek, day.blocks]));

  return blankForm().workingHours.map((empty) => {
    const blocks = stored.get(empty.dayOfWeek) ?? [];

    return blocks.length > 0
      ? {
          dayOfWeek: empty.dayOfWeek,
          open: true,
          blocks: blocks.map((block, i) => ({
            key: i + 1,
            startsAt: block.startsAt,
            endsAt: block.endsAt,
          })),
        }
      : { ...empty, open: false };
  });
}

// --- Onboarding step 8 — booking rules -------------------------------------

function toBookingPolicyForm(policy: BookingPolicy | null): BookingPolicyForm {
  if (policy === null) return blankForm().bookingPolicy;

  return {
    bookingHorizonDays: String(policy.bookingHorizonDays),
    minLeadTimeHours: policy.minLeadTimeHours,
    maxAcceptedAppointmentsPerDay: digits(policy.maxAcceptedAppointmentsPerDay),
    slotGranularityMinutes: policy.slotGranularityMinutes,
    appointmentBufferMinutes: policy.appointmentBufferMinutes,
  };
}

// --- What steers the form without ever being sent --------------------------

/**
 * The cancellation policy recovered from the notice it implies.
 *
 * The one lossy step in the round trip: 48 hours reads back as "Moderate" whether it was chosen
 * by that name or typed into the custom window. A guess rather than an answer, and it costs
 * nothing when wrong, because both settings mean the same 48 hours.
 *
 * `cancellationNotes` has nowhere to come from: the contract has no field for it. See `UiState`.
 */
function toUiState(pricing: Pricing | null): UiState {
  if (pricing === null) return blankForm().ui;

  const named = CANCELLATION_POLICIES.find(
    (policy) => policy.hours === pricing.cancellationNoticeHours
  );

  return {
    cancellationPolicy: named?.value ?? "custom",
    cancellationNotes: "",
  };
}

// --- The whole form --------------------------------------------------------

/** Everything `loadOnboarding` read, in the shape the wizard opens with. */
export interface RestoredForm {
  formData: ProfileFormData;
  stored: StoredState;
}

/**
 * The stored profile as the form and its bookkeeping.
 *
 * Returns both halves together because they are read from the same snapshot and must not drift
 * apart: `stored.services.ids` is what a later save compares the form's rows against, and a
 * form restored without it would read every existing service as a new one.
 *
 * Takes `OnboardingSnapshot` as the loader defines it rather than a structural copy of its
 * shape, so a field added to the snapshot and dropped here is a compile error.
 */
export function restore(snapshot: OnboardingSnapshot): RestoredForm {
  const profile = toProfileForm(snapshot.profile);
  const trades = toTradesForm(snapshot.trades);
  const services = toServiceForms(snapshot.services);
  const licenses = toLicenseForms(snapshot.licenses);
  const pricing = toPricingForm(snapshot.pricing);
  const workingHours = toWorkingHoursForm(snapshot.workingHours);
  const bookingPolicy = toBookingPolicyForm(snapshot.bookingPolicy);

  return {
    formData: {
      profile,
      trades,
      services,
      pricing,
      licenses,
      workingHours,
      bookingPolicy,
      ui: toUiState(snapshot.pricing),
    },
    stored: {
      businessVersion: snapshot.profile.version,
      coordinates: snapshot.profile.coordinates ?? null,
      slug: snapshot.profile.slug,
      slugLocked: snapshot.profile.slugLocked,
      pricingVersion: snapshot.pricing?.version ?? null,
      // Zero is the documented starting point: `GET` serves defaults at 0 before the row
      // exists, and a freshly provisioned row is at 0 as well.
      bookingPolicyVersion: snapshot.bookingPolicy?.version ?? 0,
      // Built from the restored form rather than from the wire object: what a later comparison
      // is made against has to come out of the very function that would produce the body being
      // compared. Null where the server holds nothing yet, which is what tells "answered and
      // unchanged" from "never answered".
      profileBody: contentOf(toCreateBusiness(profile)),
      // A business with no primary trade has never had this step stored — the contract makes
      // the primary required, so there is no body that could have been sent without one.
      tradesBody: trades.primaryTradeId === "" ? null : contentOf(toTrades(trades)),
      pricingBody: snapshot.pricing === null ? null : contentOf(toPricing(pricing, null)),
      workingHoursBody:
        snapshot.workingHours === null ? null : contentOf(toWorkingHours(workingHours)),
      bookingPolicyBody:
        snapshot.bookingPolicy === null ? null : contentOf(toBookingPolicy(bookingPolicy, 0)),
      // Built from the restored rows, for the reason given above.
      services: storedList(services, toService),
      licenses: storedList(licenses, toLicense),
    },
  };
}

/**
 * The ids in order and each id's body, for a list restored from the server.
 *
 * Through `contentOf` rather than `JSON.stringify`: these strings are compared against the ones
 * `syncList` builds when a row is about to be written, and both ends have to agree byte for
 * byte, so one function decides what a body-as-compared means.
 */
function storedList<T extends { serverId?: string }>(
  rows: T[],
  body: (row: T) => object
): StoredList {
  const stored = rows.filter((row): row is T & { serverId: string } => row.serverId !== undefined);

  return {
    ids: stored.map((row) => row.serverId),
    bodies: Object.fromEntries(stored.map((row) => [row.serverId, contentOf(body(row))])),
  };
}
