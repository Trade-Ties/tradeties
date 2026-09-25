import {
  Building2,
  ListChecks,
  DollarSign,
  CalendarClock,
  BadgeCheck,
  Rocket,
} from "lucide-react";
import type { ProfileReadiness } from "@/lib/api/wire";
import type { FocusTargetName } from "./focusTarget";
import type { StepDef, StepKey } from "./types";

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
 * `8` is the exception. The counter is a high-water mark, and the form shows `licenses` (server
 * step 6) after `availability` (server steps 7 and 8), so saving the availability screen lands on
 * 8 without the licences screen having been shown, and 8 can no longer tell whether 6 happened.
 * It points at `publish` all the same: every required step is saved by then, and the checklist
 * there is what says what is still missing. Licences are optional, and the review on that screen
 * reads them back ("None listed") with an Edit next to them, so they are not lost from sight.
 */
const RESUME_AT: Record<number, StepKey> = {
  2: "services",
  3: "services",
  4: "pricing",
  5: "availability",
  6: "availability",
  7: "availability",
  8: "publish",
  9: "publish",
};

function stepIndex(key: StepKey | undefined): number {
  const index = key === undefined ? -1 : STEPS.findIndex((step) => step.key === key);

  return index < 0 ? 0 : index;
}

type ReadinessCheckCode = ProfileReadiness["checks"][number]["code"];

/**
 * The screen, and the field on it, that settles each condition on the publish checklist. A
 * `Record` over the generated union, so a code the server adds fails the type check here rather
 * than rendering as a line that goes nowhere.
 *
 * `PRICING_SET` fails while no pricing has been stored at all, so the first field on that
 * screen is as good a place to start as any, and it happens to be the hourly rate.
 */
export const CHECK_TARGETS: Record<ReadinessCheckCode, { step: StepKey; field: FocusTargetName }> = {
  ADDRESS_GEOCODED: { step: "business", field: "postalCode" },
  PRIMARY_TRADE: { step: "services", field: "primaryTrade" },
  AT_LEAST_ONE_SERVICE: { step: "services", field: "services" },
  HOURLY_SERVICES_HAVE_A_RATE: { step: "pricing", field: "hourlyRate" },
  PRICING_SET: { step: "pricing", field: "hourlyRate" },
  WORKING_HOURS_SET: { step: "availability", field: "workingHours" },
};

export interface Resume {
  index: number;
  /** The field to put the cursor in, when the step was chosen for a condition it fails. */
  focus: FocusTargetName | null;
}

/**
 * Where the wizard reopens: the earlier of the step the saves reached and the first step
 * holding a condition the checklist fails.
 *
 * Neither alone is right. The counter only climbs, so a ZIP code that turned out to be
 * unplaceable after every step was saved still reads "go to publish"; and the checklist says
 * nothing about the screens it has no condition on, such as the booking policy, so a
 * tradesperson halfway through would be sent past a screen they never saw. A step the checklist
 * names comes with the field to land on; one reached by the counter alone opens at its top.
 *
 * `readiness` is null when the checklist could not be read, and the counter then decides alone.
 */
export function resumeAt(completedStep: number, readiness: ProfileReadiness | null): Resume {
  const reached = stepIndex(RESUME_AT[completedStep]);

  const failing = (readiness?.checks ?? [])
    .filter((check) => !check.passed)
    .map((check) => CHECK_TARGETS[check.code])
    .map((target) => ({ index: stepIndex(target.step), focus: target.field }))
    .sort((a, b) => a.index - b.index)[0];

  return failing !== undefined && failing.index <= reached
    ? failing
    : { index: reached, focus: null };
}
