import {
  Building2,
  ListChecks,
  DollarSign,
  CalendarClock,
  BadgeCheck,
  Rocket,
} from "lucide-react";
import type { ReferenceData } from "@/lib/api/reference";
import type {
  MaterialPricingMode,
  ServicePricingMode,
  TravelFeeMode,
} from "@/lib/api/wire";
import { stateName } from "./reference";
import type {
  CancellationPolicy,
  LicenseForm,
  ProfileFormData,
  ServiceForm,
  SlotGranularity,
  StepDef,
  StepKey,
  StoredState,
  TimeBlockForm,
  WorkingHoursForm,
} from "./types";

/**
 * Where the wizard lives.
 *
 * One copy because the three callers fail differently when they drift: the dashboard link goes
 * dead loudly, but a stale `revalidatePath` target just stops invalidating and serves cached
 * data with no symptom at all.
 */
export const WIZARD_PATH = "/profile/create";

/** Where a finished — or abandoned — step is read back from, and so what a write invalidates. */
export const DASHBOARD_PATH = "/dashboard";

export const STEPS: StepDef[] = [
  { key: "business", label: "Business", title: "Business", icon: Building2 },
  { key: "services", label: "Services", title: "Trades & Services", icon: ListChecks },
  { key: "pricing", label: "Pricing", title: "Pricing & Terms", icon: DollarSign },
  { key: "availability", label: "Availability", title: "Availability", icon: CalendarClock },
  { key: "licenses", label: "Licenses", title: "Licenses", icon: BadgeCheck },
  { key: "publish", label: "Publish", title: "Publish", icon: Rocket },
];

/**
 * Which step the wizard reopens on, given the server's `onboardingCompletedStep`. The value is
 * the step to continue with, not the last one saved.
 *
 * A table rather than arithmetic: the server counts one step per endpoint — business 2, trades
 * 3, services 4, pricing 5, licenses 6, working hours 7, booking policy 8 — and the form puts
 * several of those on one screen, so more than one server step maps to the same form step.
 *
 * `8` is the entry worth reading twice. The counter is a high-water mark, and the form shows
 * `licenses` (server step 6) after `availability` (server steps 7 and 8) — so saving the
 * availability screen lands on 8 without the licences screen having been shown, and 8 can no
 * longer tell whether 6 happened. It points at `licenses` because for everybody who has not
 * filled them in that is the only way that screen is ever reached again.
 */
const RESUME_AT: Record<number, StepKey> = {
  2: "services",
  3: "services",
  4: "pricing",
  5: "availability",
  6: "availability",
  7: "availability",
  8: "licenses",
  9: "publish",
};

export function resumeStepIndex(completedStep: number): number {
  const key = RESUME_AT[completedStep];
  const index = key === undefined ? -1 : STEPS.findIndex((step) => step.key === key);

  return index < 0 ? 0 : index;
}

/**
 * The seven days by name, indexed by `dayOfWeek - 1`. For display only: the form holds the week
 * as `WorkingDayForm[]` in the contract's own order, so nothing keys off these strings.
 */
const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** ISO-8601 days, Monday first, as the contract numbers them. */
const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 7];

/** Saturday and Sunday, which an empty form starts closed. */
const WEEKEND = [6, 7];

export const dayName = (dayOfWeek: number) => DAY_NAMES[dayOfWeek - 1] ?? String(dayOfWeek);

/**
 * The contract's `maxLength` for every text box on the wizard, in one table.
 *
 * On the box these stop a paste rather than a typist. Without one, an over-long value goes over
 * and comes back as `"Invalid request content."` about the whole step — a sentence naming
 * neither the field nor the length — so a field added here without a cap fails in the one way
 * the form has no way to explain.
 *
 * Mirrors `openapi.yaml`. `MONEY_MAX` and `PERCENT_MAX` are the two amount types and live below,
 * beside the rules that name the field.
 */
export const FIELD_MAX = {
  legalName: 200,
  displayName: 200,
  description: 2000,
  street: 200,
  city: 100,
  serviceName: 160,
  serviceDescription: 2000,
  licenseNumber: 64,
  licenseType: 120,
} as const;

/** The contract's own values, so a service's mode needs no translating on the way out. */
export const PRICING_MODES: { value: ServicePricingMode; label: string }[] = [
  { value: "FLAT", label: "Fixed price" },
  { value: "STARTING_AT", label: "From price" },
  { value: "HOURLY", label: "Hourly rate" },
  { value: "QUOTE_ONLY", label: "Quote only" },
];

export const DURATION_OPTIONS: { value: number; label: string }[] = Array.from(
  { length: 32 },
  (_, i) => {
    const minutes = (i + 1) * 15;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    let label: string;
    if (h === 0) label = `${m} min`;
    else if (m === 0) label = `${h} h`;
    else label = `${h} h ${m} min`;
    return { value: minutes, label };
  }
);


/**
 * What may be typed into a money or percentage box. Kept as text all the way to the wire rather
 * than parsed per keystroke: `Number("1.")` is `1`, so a field that round-trips through a
 * number cannot be typed a decimal point into.
 */
export const decimalOnly = (value: string) => value.replace(/[^\d.]/g, "");

export const MINIMUM_BILLING_OPTIONS = [30, 60, 90, 120];

export const BILLING_INCREMENT_OPTIONS = [6, 15, 30, 60];

export const CANCELLATION_WINDOW_OPTIONS = [12, 24, 48, 72];

/**
 * The named cancellation policies and the notice each one gives a client. `hours: null` marks
 * the one that has to ask: "Custom" leaves `cancellationNoticeHours` alone and lets the
 * dropdown beside it set the number. Read by both the step and the publish review.
 */
export const CANCELLATION_POLICIES: {
  value: CancellationPolicy;
  label: string;
  hours: number | null;
}[] = [
  { value: "flexible", label: "Flexible", hours: 24 },
  { value: "moderate", label: "Moderate", hours: 48 },
  { value: "strict", label: "Strict", hours: 72 },
  { value: "custom", label: "Custom", hours: null },
];

export const TRAVEL_FEE_MODES: { value: TravelFeeMode; label: string; desc: string }[] = [
  { value: "INCLUDED", label: "Included", desc: "No separate travel charge" },
  { value: "FLAT", label: "Flat rate", desc: "One fixed travel charge per job" },
  { value: "PER_MILE", label: "Per mile", desc: "Charged by distance travelled" },
];

export const MATERIAL_PRICING_MODES: {
  value: MaterialPricingMode;
  label: string;
  desc: string;
}[] = [
  { value: "INCLUDED", label: "Included", desc: "Materials are part of the price" },
  { value: "AT_COST", label: "At cost", desc: "Billed at what you paid" },
  { value: "COST_PLUS_MARKUP", label: "Cost plus markup", desc: "Billed at cost plus a percentage" },
  { value: "NOT_PROVIDED", label: "No materials", desc: "You don't supply materials" },
];

export const LICENSE_TYPE_SUGGESTIONS = [
  "Master Plumber",
  "Journeyman",
  "Apprentice",
  "Master Electrician",
  "General Contractor",
  "HVAC Contractor",
  "Roofing Contractor",
];

// Every 15 minutes across the day: "00:00" ... "23:45", plus "24:00" as an end value.
export const TIME_OPTIONS: string[] = Array.from({ length: 97 }, (_, i) => {
  const total = i * 15;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

export function formatTime(value: string): string {
  const [hStr, mStr] = value.split(":");
  const h = Number(hStr);
  if (h === 24) return "12:00 AM";
  const suffix = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${mStr} ${suffix}`;
}

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

/**
 * The hours a week the form adds up to. Shared so the hours step's header and the publish
 * review cannot disagree about what a closed day or a zero-length range is worth.
 */
export function weeklyMinutes(week: WorkingHoursForm): number {
  return week.reduce((total, day) => {
    if (!day.open) return total;

    return (
      total +
      day.blocks.reduce(
        (sum, block) => sum + Math.max(0, toMinutes(block.endsAt) - toMinutes(block.startsAt)),
        0
      )
    );
  }, 0);
}

/** The days actually worked. A day that is open but holds no range is not a working day. */
export const openDays = (week: WorkingHoursForm) =>
  week.filter((day) => day.open && day.blocks.length > 0);

/**
 * What a license is called, on its own row and in the publish review of it. Deliberately empty
 * while neither the type nor the state has been answered, because the row and the review word
 * that case differently.
 */
export function licenseHeading(
  reference: ReferenceData,
  license: { licenseType: string; state: string }
): string {
  return (
    license.licenseType.trim() ||
    (license.state ? `${stateName(reference, license.state)} license` : "")
  );
}

export const MINIMUM_NOTICE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Immediately" },
  { value: 2, label: "2 hours" },
  { value: 4, label: "4 hours" },
  { value: 24, label: "24 hours" },
  { value: 48, label: "48 hours" },
];

/** Typed to the contract's enum, so the dropdown cannot offer a value the server refuses. */
export const START_TIME_GRID_OPTIONS: SlotGranularity[] = [15, 30, 60];

export const BUFFER_OPTIONS = [0, 15, 30, 60];

/**
 * The next free key in a list the form owns. Counted off the list rather than taken from a
 * clock: copying one day of hours onto six mints six blocks at once, and React needs these
 * unique only within the form.
 */
export function nextKey(items: readonly { key: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.key), 0) + 1;
}

export function makeTimeBlock(key: number, startsAt = "08:00", endsAt = "17:00"): TimeBlockForm {
  return { key, startsAt, endsAt };
}

export function makeEmptyLicense(key: number, defaultState = ""): LicenseForm {
  return {
    key,
    state: defaultState,
    licenseNumber: "",
    licenseType: "",
    issuedOn: "",
    expiresOn: "",
  };
}

/**
 * Pre-filled with the trade the business leads with, because every service has one.
 *
 * `tradeId` is empty only when there is nothing to pre-fill — a service added before step 3 was
 * answered. That row is incomplete in the same way a nameless one is: the step badges it and
 * `serviceIsWritable` holds it back, rather than the save inventing a trade for it.
 */
export function makeEmptyService(key: number, primaryTradeId: string): ServiceForm {
  return {
    key,
    tradeId: primaryTradeId,
    name: "",
    description: "",
    estimatedDurationMinutes: 60,
    pricingMode: "FLAT",
    price: "",
  };
}

export const nothingStored: StoredState = {
  businessVersion: null,
  coordinates: null,
  slug: null,
  slugLocked: false,
  pricingVersion: null,
  bookingPolicyVersion: 0,
  // Nothing has been written, so there is no stored body to compare against. `save.ts` reads
  // that as "still untouched" and compares against what an empty form would send instead.
  profileBody: null,
  tradesBody: null,
  pricingBody: null,
  workingHoursBody: null,
  bookingPolicyBody: null,
  services: { ids: [], bodies: {} },
  licenses: { ids: [], bodies: {} },
};

/**
 * The booking horizon's bounds, which are `BookingPolicyInput.bookingHorizonDays`'s own.
 *
 * Here rather than at the three places that apply them — the field's hint, its ceiling, the
 * mapper's clamp — because a mapper clamping to a figure the contract has moved rewrites the
 * value between what the box shows and what is stored, with a successful save to hide it.
 */
export const BOOKING_HORIZON_MIN = 1;
export const BOOKING_HORIZON_MAX = 730;

/**
 * The contract's `maxLength` for the two amount types, which are their column widths:
 * `MoneyAmount` is `NUMERIC(19,4)` and `PercentAmount` is `NUMERIC(5,2)`. On the box they stop
 * a paste rather than a typist — the rule that names the field is `moneyProblem` and
 * `percentProblem`.
 */
export const MONEY_MAX = 20;
export const PERCENT_MAX = 6;

/**
 * A form nobody has touched yet, built fresh on every call.
 *
 * A function rather than a constant because most of its readers edit what they are given. From
 * one shared object the arrays and nested objects would be the same ones every time, so a
 * single edit in place would change what every future empty form starts with.
 */
export function blankForm(): ProfileFormData {
  return {
    profile: {
      slug: "",
      legalName: "",
      displayName: "",
      description: "",
      websiteUrl: "",
      phone: "",
      email: "",
      address: { street1: "", street2: "", city: "", state: "", postalCode: "" },
      timeZone: "",
      serviceRadiusMiles: 15,
    },
    trades: { primaryTradeId: "", additionalTradeIds: [] },
    services: [],
    pricing: {
      hourlyRate: "",
      minimumBillableMinutes: 60,
      billingIncrementMinutes: 15,
      serviceCallFee: "",
      serviceCallFeeWaivedIfHired: false,
      travelFeeMode: "INCLUDED",
      travelFlatFee: "",
      travelRatePerMile: "",
      freeTravelRadiusMiles: "",
      materialPricingMode: "INCLUDED",
      materialMarkupPercent: "",
      cancellationFee: "0",
      cancellationNoticeHours: 24,
    },
    licenses: [],
    // Built from the contract's numbering rather than from day names, so the order the wire
    // wants is the order the form already holds.
    workingHours: DAYS_OF_WEEK.map((dayOfWeek) => ({
      dayOfWeek,
      open: !WEEKEND.includes(dayOfWeek),
      blocks: [makeTimeBlock(1)],
    })),
    bookingPolicy: {
      bookingHorizonDays: "60",
      minLeadTimeHours: 24,
      maxAcceptedAppointmentsPerDay: "",
      slotGranularityMinutes: 30,
      appointmentBufferMinutes: 0,
    },
    ui: { cancellationPolicy: "flexible", cancellationNotes: "" },
  };
}

/**
 * One such form, for the readers that only ever compare against it — `save.ts` asks what an
 * untouched step looks like on the wire. Nothing here may be edited.
 */
export const emptyFormData: ProfileFormData = blankForm();
