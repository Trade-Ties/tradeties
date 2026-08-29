import type {
  MaterialPricingMode,
  ServicePricingMode,
  TravelFeeMode,
} from "@/lib/api/wire";
import type { CancellationPolicy, SlotGranularity } from "./types";

/**
 * What each choice on the wizard offers. **The `value` is always what the API takes back** and
 * the label is only what it reads as on screen — the lists whose values are a contract enum are
 * typed as one, so a value the server would refuse does not compile.
 */

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

export const MINIMUM_BILLING_OPTIONS = [30, 60, 90, 120];

export const BILLING_INCREMENT_OPTIONS = [6, 15, 30, 60];

export const CANCELLATION_WINDOW_OPTIONS = [12, 24, 48, 72];

/**
 * The named cancellation policies and the notice each gives a client. `hours: null` means the
 * policy sets no notice itself: "Custom" leaves `cancellationNoticeHours` to the dropdown beside
 * it.
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

export const MINIMUM_NOTICE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Immediately" },
  { value: 2, label: "2 hours" },
  { value: 4, label: "4 hours" },
  { value: 24, label: "24 hours" },
  { value: 48, label: "48 hours" },
];

export const START_TIME_GRID_OPTIONS: SlotGranularity[] = [15, 30, 60];

export const BUFFER_OPTIONS = [0, 15, 30, 60];
