import type { ServiceJob, Trade, UsState, UsTimeZone } from "./wire";

export type { ServiceJob, Trade, UsState, UsTimeZone };

export interface ReferenceData {
  trades: Trade[];
  /**
   * Every job the marketplace has a name for, unfiltered. Step 4's picker narrows it to the
   * trades chosen in step 3 — which can be chosen in the same sitting, so a list the server had
   * already narrowed would be stale by the time it was shown.
   */
  serviceJobs: ServiceJob[];
  states: UsState[];
  timeZones: UsTimeZone[];
}
