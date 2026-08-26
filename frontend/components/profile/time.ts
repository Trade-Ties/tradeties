import type { WorkingHoursForm } from "./types";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** ISO-8601 days, Monday first, as the contract numbers them. */
export const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 7];

export const WEEKEND = [6, 7];

export const dayName = (dayOfWeek: number) => DAY_NAMES[dayOfWeek - 1] ?? String(dayOfWeek);

// Every 15 minutes across the day: "00:00" ... "23:45", plus "24:00" as an end value.
export const TIME_OPTIONS: string[] = Array.from({ length: 97 }, (_, i) => {
  const total = i * 15;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

export function formatTime(value: string): string {
  const [hStr, mStr] = value.split(":");
  const h = Number(hStr);
  if (h === 24) return "12:00 AM";
  const suffix = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${mStr} ${suffix}`;
}

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

export function weeklyMinutes(week: WorkingHoursForm): number {
  return week.reduce((total, day) => {
    if (!day.open) return total;

    return (
      total +
      day.blocks.reduce(
        (sum, block) => sum + Math.max(0, toMinutes(block.endsAt) - toMinutes(block.startsAt)),
        0
      )
    );
  }, 0);
}

/** A day that is open but holds no range is not a working day. */
export const openDays = (week: WorkingHoursForm) =>
  week.filter((day) => day.open && day.blocks.length > 0);
