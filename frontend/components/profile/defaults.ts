import { DAYS_OF_WEEK, WEEKEND } from "./time";
import type {
  LicenseForm,
  ProfileFormData,
  ServiceForm,
  StoredState,
  TimeBlockForm,
} from "./types";

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
 * `tradeId` is empty only when there is nothing to pre-fill — a service added before step 3 was
 * answered. Such a row counts as incomplete: the step badges it and `serviceIsWritable` holds it
 * back rather than the save inventing a trade for it.
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

/**
 * A form nobody has touched yet, built fresh on every call.
 *
 * A function rather than a constant because most of its readers edit what they are given: from
 * one shared object the arrays and nested objects would be the same ones every time, so a single
 * edit in place would change what every future empty form starts with.
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

/** One such form, for readers that only compare against it. Nothing here may be edited. */
export const emptyFormData: ProfileFormData = blankForm();

export const nothingStored: StoredState = {
  businessVersion: null,
  coordinates: null,
  slug: null,
  slugLocked: false,
  pricingVersion: null,
  bookingPolicyVersion: 0,
  // `save.ts` reads null as "still untouched" and compares against what an empty form would send.
  profileBody: null,
  tradesBody: null,
  pricingBody: null,
  workingHoursBody: null,
  bookingPolicyBody: null,
  services: { ids: [], bodies: {} },
  licenses: { ids: [], bodies: {} },
};
