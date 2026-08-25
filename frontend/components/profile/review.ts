import type { ReferenceData } from "@/lib/api/reference";
import {
  CANCELLATION_POLICIES,
  MATERIAL_PRICING_MODES,
  MINIMUM_NOTICE_OPTIONS,
  STEPS,
  TRAVEL_FEE_MODES,
  dayName,
  formatHours,
  licenseHeading,
  openDays,
  weeklyMinutes,
} from "./constants";
import { timeZoneName, tradeName } from "./reference";
import { statesAnAmount } from "./toWire";
import { REQUIRED_PROFILE_FIELDS, type RequiredProfileField } from "./validate";
import type {
  AddressForm,
  ProfileFormData,
  StepKey,
} from "./types";

export interface ReviewRow {
  label: string;
  /** What was answered. Empty means the question is still open. */
  value: string;
  /** An empty required row is what holds publishing back. */
  required?: boolean;
}

export interface ReviewGroup {
  stepKey: StepKey;
  title: string;
  rows: ReviewRow[];
}

/**
 * A row of steps 1 and 2, marked required by the table that decides it. Asked rather than
 * asserted, so this screen and the Business step's Next button cannot disagree about which
 * answers a profile cannot exist without.
 */
const profileRow = (field: RequiredProfileField, label: string, value: string): ReviewRow => ({
  label,
  required: REQUIRED_PROFILE_FIELDS.has(field),
  value,
});

function summarise(items: string[], max = 3): string {
  if (items.length === 0) return "";
  const shown = items.slice(0, max).join(", ");
  return items.length > max ? `${shown} +${items.length - max} more` : shown;
}

/**
 * An amount as this screen prints it, or nothing where the wire would send nothing.
 *
 * Asked of `statesAnAmount` rather than of `trim()`: a box holding a bare "." is not empty and
 * carries no amount, and printing "$." here would read the answer back as given while the
 * server was never told a figure at all.
 */
const money = (value: string) => (statesAnAmount(value) ? `$${value.trim()}` : "");

/**
 * What the tradesperson charges for getting there, in one line. The free radius is read under
 * every charging mode, because the step collects it under every charging mode. `fallback` is
 * the mode's own label, which is all there is to say when travel is included.
 */
function travelSummary(p: ProfileFormData["pricing"], fallback: string): string {
  if (p.travelFeeMode === "INCLUDED") return fallback;

  const free = p.freeTravelRadiusMiles.trim();
  const suffix = free ? `, first ${free} mi free` : "";

  return p.travelFeeMode === "FLAT"
    ? `${money(p.travelFlatFee) || "Flat rate"} per job${suffix}`
    : `${money(p.travelRatePerMile) || "Charged"} per mile${suffix}`;
}

/** The address on one line, or nothing at all while a part of it is missing. */
function formatAddress(a: AddressForm): string {
  if (!a.street1.trim() || !a.city.trim() || !a.state || !a.postalCode.trim()) return "";
  const street = [a.street1.trim(), a.street2.trim()].filter(Boolean).join(", ");
  return `${street}, ${a.city.trim()}, ${a.state} ${a.postalCode.trim()}`;
}

function group(stepKey: StepKey, rows: ReviewRow[]): ReviewGroup {
  const step = STEPS.find((s) => s.key === stepKey);

  return {
    stepKey,
    title: step?.title ?? stepKey,
    rows: rows.filter((row) => row.value !== "" || row.required),
  };
}

/**
 * The wizard read back to the tradesperson, grouped by the step that answers each part.
 *
 * This reads the form; what publishing actually applies is the server's checklist — see
 * `canPublish` in `ProfileWizard`.
 *
 * Takes the catalogue because three answers are stored as references into it: two trade fields
 * and a time zone.
 */
export function buildReview(d: ProfileFormData, reference: ReferenceData): ReviewGroup[] {
  const namedServices = d.services.filter((s) => s.name.trim() !== "");
  // A price the mode actually carries. `toWire` clears the amount of a QUOTE_ONLY service on
  // the way out, so a figure left behind under a mode since switched to quote-only is not a
  // price this business states — reading it as one says "priced per service" for a profile
  // that quotes every job.
  const anyServicePriced = d.services.some(
    (s) => s.pricingMode !== "QUOTE_ONLY" && statesAnAmount(s.price)
  );
  // The server's own condition, restated: only an hourly service without its own price makes
  // the general hourly rate necessary.
  const needsGeneralRate =
    !statesAnAmount(d.pricing.hourlyRate) &&
    d.services.some((s) => s.pricingMode === "HOURLY" && !statesAnAmount(s.price));
  const policy = CANCELLATION_POLICIES.find((p) => p.value === d.ui.cancellationPolicy);
  const travel = TRAVEL_FEE_MODES.find((m) => m.value === d.pricing.travelFeeMode);
  const material = MATERIAL_PRICING_MODES.find((m) => m.value === d.pricing.materialPricingMode);
  const notice = MINIMUM_NOTICE_OPTIONS.find(
    (o) => o.value === d.bookingPolicy.minLeadTimeHours
  );
  const days = openDays(d.workingHours);

  return [
    group("business", [
      profileRow("legalName", "Name", d.profile.legalName.trim()),
      profileRow("displayName", "Shown as", d.profile.displayName.trim()),
      profileRow("slug", "Profile URL", d.profile.slug.trim()),
      profileRow("email", "Email", d.profile.email.trim()),
      profileRow("phone", "Phone", d.profile.phone.trim()),
      { label: "Website", value: d.profile.websiteUrl.trim() },
      profileRow("address", "Address", formatAddress(d.profile.address)),
      { label: "Service area", value: `${d.profile.serviceRadiusMiles} miles` },
      profileRow("timeZone", "Timezone", timeZoneName(reference, d.profile.timeZone)),
    ]),

    group("services", [
      {
        label: "Primary trade",
        required: true,
        value: tradeName(reference, d.trades.primaryTradeId),
      },
      {
        label: "Also offering",
        // A trade the catalogue no longer names is left out rather than summarised as a blank.
        value: summarise(
          d.trades.additionalTradeIds.map((id) => tradeName(reference, id)).filter(Boolean)
        ),
      },
      {
        label: "Services",
        required: true,
        value: summarise(namedServices.map((s) => s.name.trim())),
      },
    ]),

    group("pricing", [
      {
        label: "Rates",
        // Required exactly where the server requires it, and nowhere else. Its check is
        // `hourlyServicesHaveARate`: an HOURLY service with no price of its own needs the
        // general rate to fall back on. A business that quotes every job needs no rate at all.
        required: needsGeneralRate,
        value: statesAnAmount(d.pricing.hourlyRate)
          ? `${money(d.pricing.hourlyRate)} / hour`
          : anyServicePriced
            ? "Priced per service"
            : "",
      },
      {
        label: "Service call fee",
        value: statesAnAmount(d.pricing.serviceCallFee)
          ? money(d.pricing.serviceCallFee) +
            (d.pricing.serviceCallFeeWaivedIfHired ? " — waived when the job is booked" : "")
          : "",
      },
      { label: "Travel", value: travelSummary(d.pricing, travel?.label ?? "") },
      {
        label: "Materials",
        value:
          d.pricing.materialPricingMode === "COST_PLUS_MARKUP" &&
          d.pricing.materialMarkupPercent.trim()
            ? `Cost plus ${d.pricing.materialMarkupPercent.trim()}%`
            : (material?.label ?? ""),
      },
      {
        label: "Cancellation",
        value: policy
          ? `${policy.label} — ${d.pricing.cancellationNoticeHours} hours notice`
          : "",
      },
      {
        label: "Cancellation fee",
        // `requiredMoney` sends "0" for anything that states no amount, so a box holding "."
        // is no fee — and `Number(".")` is NaN, which the zero test alone would let through.
        value:
          !statesAnAmount(d.pricing.cancellationFee) ||
          Number(d.pricing.cancellationFee) === 0
            ? "None"
            : money(d.pricing.cancellationFee),
      },
    ]),

    group("availability", [
      {
        label: "Working days",
        required: true,
        value: days.map((day) => dayName(day.dayOfWeek).slice(0, 3)).join(", "),
      },
      {
        label: "Hours a week",
        value: days.length > 0 ? formatHours(weeklyMinutes(d.workingHours)) : "",
      },
      {
        label: "Bookable ahead",
        value: d.bookingPolicy.bookingHorizonDays.trim()
          ? `${d.bookingPolicy.bookingHorizonDays} days`
          : "",
      },
      { label: "Minimum notice", value: notice?.label ?? "" },
      {
        label: "Jobs a day",
        value: d.bookingPolicy.maxAcceptedAppointmentsPerDay.trim() || "Unlimited",
      },
    ]),

    group("licenses", [
      {
        label: "Licenses",
        value:
          d.licenses.length === 0
            ? "None listed"
            : summarise(
                d.licenses.map((l) => licenseHeading(reference, l) || "Untitled license")
              ),
      },
    ]),
  ];
}

/**
 * How many required answers one group is still holding open. `group` has already dropped the
 * optional rows that were left empty, so every empty row left here is a required one.
 */
export function missingIn(group: ReviewGroup): number {
  return group.rows.filter((r) => r.value === "").length;
}
