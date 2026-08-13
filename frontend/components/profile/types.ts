import type { LucideIcon } from "lucide-react";

export interface BusinessInfo {
  legalName: string;
  description: string;
  website: string;
  phone: string;
  email: string;
}

export interface TradeInfo {
  primaryTrade: string;
  additionalTrades: string[];
}

export type PriceModel = "fixed" | "from" | "hourly" | "quote";

export interface ServiceItem {
  id: number;
  name: string;
  description: string;
  trade: string;
  durationMinutes: number;
  priceModel: PriceModel;
  price: string;
}

export type TravelModel = "included" | "flat" | "perMile";
export type MaterialModel = "included" | "atCost" | "costPlus" | "none";

export interface PricingInfo {
  hourlyRate: string;
  minimumBillingMinutes: number; // 30 | 60 | 90 | 120
  billingIncrementMinutes: number; // 6 | 15 | 30 | 60
  serviceCallFee: string;
  waiveCallFeeOnBooking: boolean;
  travelModel: TravelModel;
  travelFlatRate: string; // only when travelModel === "flat"
  travelPerMile: string; // only when travelModel === "perMile"
  freeTravelMiles: string;
  materialModel: MaterialModel;
  materialMarkupPercent: string; // only when materialModel === "costPlus"
}

export interface TimeBlock {
  id: number;
  start: string; // "HH:MM" on a 15-minute grid
  end: string;   // must be after start
}

export interface DayHours {
  open: boolean;
  blocks: TimeBlock[];
}

export type WorkingHours = Record<string, DayHours>;

export interface LocationInfo {
  street: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  timezone: string;
  radius: number;
}

export interface LicenseEntry {
  id: number;
  state: string; // two-letter US state code
  number: string;
  type: string; // free text, with suggestions
  issuedOn: string; // yyyy-mm-dd
  validUntil: string; // yyyy-mm-dd
}

export interface BookingPrefs {
  bookableAheadDays: number;       // 1..730
  minimumNoticeHours: number;      // 0 | 2 | 4 | 24 | 48  (0 = immediately)
  unlimitedPerDay: boolean;
  maxPerDay: string;               // ignored while unlimitedPerDay is true
  startTimeGridMinutes: number;    // 15 | 30 | 60
  bufferMinutes: number;           // 0 | 15 | 30 | 60
}

export interface ProfileFormData {
  business: BusinessInfo;
  trade: TradeInfo;
  services: ServiceItem[];
  pricing: PricingInfo;
  licenses: LicenseEntry[];
  hours: WorkingHours;
  location: LocationInfo;
  booking: BookingPrefs;
  cancellation: CancellationInfo;
  publish: PublishInfo;
}

export interface CancellationInfo {
  policy: "flexible" | "moderate" | "strict" | "custom";
  windowHours: number; // 12 | 24 | 48 | 72, used when policy === "custom"
  fee: string;
  notes: string;
}

export interface PublishInfo {
  published: boolean;
}

export type StepKey = keyof ProfileFormData;

export interface StepDef {
  key: StepKey;
  label: string;
  icon: LucideIcon;
}

export interface StepProps<T> {
  data: T;
  update: (value: T) => void;
}
