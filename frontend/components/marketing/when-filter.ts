import { addDays, format, isSameDay, isValid, parse } from "date-fns";

// Shared by /browse's full filter panel and the simplified search-results
// page — both need to turn a day-ish filter (and the hero search bar's
// ?when= handoff) into an actual date comparison, using the same local
// "today" both pages already compute independently.
export const today = new Date(new Date().setHours(0, 0, 0, 0));
export const tomorrow = addDays(today, 1);
export const weekCutoff = addDays(today, 6);

export type AvailabilityFilter = "any" | "today" | "tomorrow" | "week" | "date";

// The human label for a given availability + (if "date") custom date —
// shared so the initial ?when= parse and any later in-page editing of the
// same filter always describe it the same way.
export function availabilityLabel(availability: AvailabilityFilter, customDate: Date | undefined): string {
  switch (availability) {
    case "today":
      return "Today";
    case "tomorrow":
      return "Tomorrow";
    case "week":
      return "This week";
    case "date":
      return customDate ? format(customDate, "EEE, MMM d") : "Choose a date";
    default:
      return "Any time";
  }
}

// Reads the ?when= param the hero search bar hands off — "today"/"tomorrow"
// map directly, "flexible" maps to the closest thing either page has (any
// slot within the week), and anything else is tried as a yyyy-MM-dd date.
export function parseWhenParam(value: string | null | undefined): {
  availability: AvailabilityFilter;
  customDate: Date | undefined;
  label: string;
} {
  if (value === "today") return { availability: "today", customDate: undefined, label: availabilityLabel("today", undefined) };
  if (value === "tomorrow")
    return { availability: "tomorrow", customDate: undefined, label: availabilityLabel("tomorrow", undefined) };
  if (value === "flexible") return { availability: "week", customDate: undefined, label: availabilityLabel("week", undefined) };
  if (value) {
    const parsed = parse(value, "yyyy-MM-dd", today);
    if (isValid(parsed)) return { availability: "date", customDate: parsed, label: availabilityLabel("date", parsed) };
  }
  return { availability: "any", customDate: undefined, label: availabilityLabel("any", undefined) };
}

export function dateMatchesAvailability(
  date: Date,
  availability: AvailabilityFilter,
  customDate: Date | undefined
): boolean {
  switch (availability) {
    case "today":
      return isSameDay(date, today);
    case "tomorrow":
      return isSameDay(date, tomorrow);
    case "week":
      return date <= weekCutoff;
    case "date":
      return customDate ? isSameDay(date, customDate) : true;
    default:
      return true;
  }
}

export type TimeBucket = "all" | "morning" | "afternoon" | "evening";

// A slot's `time` is a plain "h:mm a" string (e.g. "2:15 PM") — parsed
// against an arbitrary reference date since only the hour matters here.
export function slotTimeBucket(time: string): Exclude<TimeBucket, "all"> {
  const hour = parse(time, "h:mm a", today).getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
