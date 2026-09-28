/**
 * The time zone most of each state keeps, so the wizard can fill it in from the address instead
 * of asking. Only the six zones the marketplace offers (`GET /api/v1/time-zones`).
 *
 * A suggestion, not a rule: the states in {@link SPLIT_STATES} have a part on another zone — the
 * Florida panhandle, western Kentucky, eastern Tennessee — and a tradesperson there changes it.
 */
const ZONE_BY_STATE: Record<string, string> = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Denver",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  DC: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  ID: "America/Denver",
  IL: "America/Chicago",
  IN: "America/New_York",
  IA: "America/Chicago",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/New_York",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  MT: "America/Denver",
  NE: "America/Chicago",
  NV: "America/Los_Angeles",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NY: "America/New_York",
  NC: "America/New_York",
  ND: "America/Chicago",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VT: "America/New_York",
  VA: "America/New_York",
  WA: "America/Los_Angeles",
  WV: "America/New_York",
  WI: "America/Chicago",
  WY: "America/Denver",
};

/** States with a part on a second zone, where the suggestion comes with a word of caution. */
const SPLIT_STATES = new Set(["AK", "FL", "ID", "IN", "KS", "KY", "MI", "NE", "ND", "OR", "SD", "TN", "TX"]);

/** The zone to suggest for a state, or empty for one the table does not know. */
export function zoneForState(state: string): string {
  return ZONE_BY_STATE[state] ?? "";
}

export function isSplitState(state: string): boolean {
  return SPLIT_STATES.has(state);
}
