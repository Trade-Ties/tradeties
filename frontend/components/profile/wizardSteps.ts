import {
  Building2,
  ListChecks,
  DollarSign,
  CalendarClock,
  BadgeCheck,
  Rocket,
} from "lucide-react";
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
 * It points at `licenses` because for anyone who has not filled them in that is the only way that
 * screen is reached again.
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
