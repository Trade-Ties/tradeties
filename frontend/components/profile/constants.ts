import {
  Building2,
  Hammer,
  ListChecks,
  DollarSign,
  Clock,
  MapPin,
  CalendarClock,
  BadgeCheck,
  ShieldCheck,
  Rocket,
} from "lucide-react";
import type {
  StepDef,
  ProfileFormData,
  WorkingHours,
  PriceModel,
  TravelModel,
  MaterialModel,
} from "./types";

export const STEPS: StepDef[] = [
  { key: "business", label: "Business Info", icon: Building2 },
  { key: "location", label: "Location & Radius", icon: MapPin },
  { key: "trade", label: "Trade", icon: Hammer },
  { key: "services", label: "Services", icon: ListChecks },
  { key: "pricing", label: "Pricing", icon: DollarSign },
  { key: "licenses", label: "Licenses", icon: BadgeCheck },
  { key: "hours", label: "Working Hours", icon: Clock },
  { key: "booking", label: "Booking Prefs", icon: CalendarClock },
  { key: "cancellation", label: "Cancellation", icon: ShieldCheck },
  { key: "publish", label: "Publish", icon: Rocket },
];

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
];

export const US_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern Time (New York)" },
  { value: "America/Chicago", label: "Central Time (Chicago)" },
  { value: "America/Denver", label: "Mountain Time (Denver)" },
  { value: "America/Phoenix", label: "Mountain Time — no DST (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska Time (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (Honolulu)" },
];

export const TRADE_CATEGORIES = [
  "Electrician",
  "Plumber",
  "Carpenter",
  "Painter",
  "HVAC Technician",
  "Landscaper",
  "General Contractor",
  "Roofer",
  "Mason",
  "Flooring Specialist",
  "Locksmith",
  "Other",
];

// Sentinel value for services that aren't tied to one specific trade.
export const CROSS_TRADE = "__cross_trade__";

export const SERVICE_NAME_MAX = 160;

export const PRICE_MODELS: { value: PriceModel; label: string }[] = [
  { value: "fixed", label: "Fixed price" },
  { value: "from", label: "From price" },
  { value: "hourly", label: "Hourly rate" },
  { value: "quote", label: "Quote only" },
];

// 15 min to 8 h in 15-minute steps.
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


export const MINIMUM_BILLING_OPTIONS = [30, 60, 90, 120];

export const BILLING_INCREMENT_OPTIONS = [6, 15, 30, 60];

export const CANCELLATION_WINDOW_OPTIONS = [12, 24, 48, 72];

export const TRAVEL_MODELS: { value: TravelModel; label: string; desc: string }[] = [
  { value: "included", label: "Included", desc: "No separate travel charge" },
  { value: "flat", label: "Flat rate", desc: "One fixed travel charge per job" },
  { value: "perMile", label: "Per mile", desc: "Charged by distance travelled" },
];

export const MATERIAL_MODELS: { value: MaterialModel; label: string; desc: string }[] = [
  { value: "included", label: "Included", desc: "Materials are part of the price" },
  { value: "atCost", label: "At cost", desc: "Billed at what you paid" },
  { value: "costPlus", label: "Cost plus markup", desc: "Billed at cost plus a percentage" },
  { value: "none", label: "No materials", desc: "You don't supply materials" },
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

/** "13:30" -> "1:30 PM" for display. */
export function formatTime(value: string): string {
  const [hStr, mStr] = value.split(":");
  const h = Number(hStr);
  if (h === 24) return "12:00 AM";
  const suffix = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${mStr} ${suffix}`;
}

export const MINIMUM_NOTICE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Immediately" },
  { value: 2, label: "2 hours" },
  { value: 4, label: "4 hours" },
  { value: 24, label: "24 hours" },
  { value: 48, label: "48 hours" },
];

export const START_TIME_GRID_OPTIONS = [15, 30, 60];

export const BUFFER_OPTIONS = [0, 15, 30, 60];

export function makeTimeBlock(id: number, start = "08:00", end = "17:00") {
  return { id, start, end };
}

export function makeEmptyLicense(id: number, defaultState = "") {
  return {
    id,
    state: defaultState,
    number: "",
    type: "",
    issuedOn: "",
    validUntil: "",
  };
}

export function makeEmptyService(id: number) {
  return {
    id,
    name: "",
    description: "",
    trade: "",
    durationMinutes: 60,
    priceModel: "fixed" as PriceModel,
    price: "",
  };
}

export const emptyFormData: ProfileFormData = {
  business: {
    legalName: "",
    description: "",
    website: "",
    phone: "",
    email: "",
  },
  trade: { primaryTrade: "", additionalTrades: [] },
  services: [makeEmptyService(1)],
  pricing: {
    hourlyRate: "",
    minimumBillingMinutes: 60,
    billingIncrementMinutes: 15,
    serviceCallFee: "",
    waiveCallFeeOnBooking: false,
    travelModel: "included",
    travelFlatRate: "",
    travelPerMile: "",
    freeTravelMiles: "",
    materialModel: "included",
    materialMarkupPercent: "",
  },
  licenses: [],
  hours: DAYS.reduce((acc, day, i) => {
    acc[day] = {
      open: day !== "Saturday" && day !== "Sunday",
      blocks: [makeTimeBlock(i + 1)],
    };
    return acc;
  }, {} as WorkingHours),
  location: {
    street: "",
    addressLine2: "",
    city: "",
    state: "",
    zip: "",
    timezone: "",
    radius: 15,
  },
  booking: {
    bookableAheadDays: 60,
    minimumNoticeHours: 24,
    unlimitedPerDay: true,
    maxPerDay: "",
    startTimeGridMinutes: 30,
    bufferMinutes: 0,
  },
  cancellation: { policy: "flexible", windowHours: 24, fee: "0", notes: "" },
  publish: { published: false },
};
