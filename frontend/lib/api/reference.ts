import type { Trade, UsState, UsTimeZone } from "./wire";

export type { Trade, UsState, UsTimeZone };

export interface ReferenceData {
  trades: Trade[];
  states: UsState[];
  timeZones: UsTimeZone[];
}
