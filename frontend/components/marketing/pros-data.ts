import { addDays, differenceInCalendarDays } from "date-fns";
import {
  BrickWall,
  Brush,
  Car,
  Cog,
  Droplet,
  Hammer,
  HardHat,
  Home,
  KeyRound,
  Layers,
  LayoutGrid,
  PaintRoller,
  Plug,
  Trees,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

// Shared mock listing data — used by both the homepage's availability rail
// (a short teaser) and the full /browse page (the whole list, filterable).
// Single source of truth so a pro's rate/miles can't drift between
// the two pages. Swap this whole module for a real API call once listings
// are backed by actual tradesperson profiles.

// Computed at import time (both pages that use this render client-side) so
// "today" always reflects the visitor's own local date, and slot dates
// below are relative to it rather than hardcoded weekdays that would read
// as wrong on most days of the year.
const today = new Date(new Date().setHours(0, 0, 0, 0));

export interface ProSlot {
  date: Date;
  time: string;
}

export interface Pro {
  initials: string;
  color: string;
  name: string;
  business: string;
  trade: string;
  miles: number;
  /** Hourly starting rate, in USD — what the profile lists as its base rate. */
  rateFrom: number;
  /** Display only — no site sits behind it, so it is never rendered as a link. */
  website: string;
  /** Neighborhood/city, not an address — the same imprecision `miles` already has, worded instead of measured. */
  location: string;
  /** What this pro is listed for — a subset of SERVICES_BY_TRADE[trade], drives the Service filter. */
  services: string[];
  slots: ProSlot[];
}

export const PROS: Pro[] = [
  {
    initials: "MW", color: "#1E4E82", name: "Marcus Webb", business: "Webb Plumbing Co.",
    trade: "Plumber", miles: 2.4, rateFrom: 85,
    website: "webbplumbingco.com", location: "Capitol Hill, Denver, CO",
    services: ["Leaking faucet", "Clogged drain"],
    slots: [
      { date: addDays(today, 0), time: "2:15 PM" },
      { date: addDays(today, 0), time: "4:00 PM" },
      { date: addDays(today, 0), time: "5:30 PM" },
      { date: addDays(today, 1), time: "9:00 AM" },
      { date: addDays(today, 1), time: "11:30 AM" },
      { date: addDays(today, 2), time: "2:00 PM" },
    ],
  },
  {
    initials: "DA", color: "#0E9F6E", name: "Denise Alvarez", business: "Front Range Electric",
    trade: "Electrician", miles: 3.1, rateFrom: 95,
    website: "frontrangeelectric.com", location: "Highlands, Denver, CO",
    services: ["Outlet not working", "Panel upgrade"],
    slots: [
      { date: addDays(today, 0), time: "3:00 PM" },
      { date: addDays(today, 0), time: "6:15 PM" },
      { date: addDays(today, 1), time: "11:30 AM" },
      { date: addDays(today, 1), time: "2:00 PM" },
      { date: addDays(today, 2), time: "10:15 AM" },
      { date: addDays(today, 2), time: "3:30 PM" },
    ],
  },
  {
    initials: "RO", color: "#B4530A", name: "Ray Okonkwo", business: "Okonkwo Heating & Air",
    trade: "HVAC", miles: 5.7, rateFrom: 110,
    website: "okonkwoheatingair.com", location: "Aurora, CO",
    services: ["Furnace won't start", "Annual tune-up"],
    slots: [
      { date: addDays(today, 3), time: "8:00 AM" },
      { date: addDays(today, 3), time: "10:30 AM" },
      { date: addDays(today, 4), time: "2:00 PM" },
      { date: addDays(today, 4), time: "3:30 PM" },
      { date: addDays(today, 5), time: "10:15 AM" },
      { date: addDays(today, 5), time: "1:30 PM" },
    ],
  },
  {
    initials: "TB", color: "#0A2F5C", name: "Tom Brennan", business: "Brennan Carpentry",
    trade: "Carpenter", miles: 4.2, rateFrom: 75,
    website: "brennancarpentry.com", location: "Washington Park, Denver, CO",
    services: ["Deck repair", "Shelving install"],
    slots: [
      { date: addDays(today, 1), time: "9:00 AM" },
      { date: addDays(today, 3), time: "1:00 PM" },
      { date: addDays(today, 4), time: "10:15 AM" },
      { date: addDays(today, 4), time: "3:30 PM" },
      { date: addDays(today, 5), time: "9:00 AM" },
      { date: addDays(today, 5), time: "1:30 PM" },
    ],
  },
  {
    initials: "AP", color: "#6D3FA8", name: "Ana Petrova", business: "Keystone Lock & Key",
    trade: "Locksmith", miles: 1.8, rateFrom: 65,
    website: "keystonelockkey.com", location: "LoDo, Denver, CO",
    services: ["Door won't lock", "Locked out"],
    slots: [
      { date: addDays(today, 0), time: "1:45 PM" },
      { date: addDays(today, 0), time: "7:00 PM" },
      { date: addDays(today, 1), time: "10:15 AM" },
      { date: addDays(today, 1), time: "1:30 PM" },
      { date: addDays(today, 2), time: "9:00 AM" },
      { date: addDays(today, 2), time: "11:30 AM" },
    ],
  },
  {
    initials: "LR", color: "#B91C1C", name: "Luis Ramirez", business: "Ramirez Home Repair",
    trade: "Handyman", miles: 3.6, rateFrom: 60,
    website: "ramirezhomerepair.com", location: "Five Points, Denver, CO",
    services: ["Furniture assembly", "Small repairs"],
    slots: [
      { date: addDays(today, 0), time: "4:30 PM" },
      { date: addDays(today, 3), time: "9:00 AM" },
      { date: addDays(today, 4), time: "9:00 AM" },
      { date: addDays(today, 4), time: "1:30 PM" },
      { date: addDays(today, 5), time: "11:30 AM" },
      { date: addDays(today, 5), time: "2:00 PM" },
    ],
  },
  {
    initials: "SK", color: "#CA8A04", name: "Sofia Kim", business: "Kim & Sons Painting",
    trade: "Painter", miles: 2.9, rateFrom: 55,
    website: "kimandsonspainting.com", location: "Cherry Creek, Denver, CO",
    services: ["Interior room repaint", "Cabinet refinishing"],
    // Deliberately outside the 7-day window — the only listing "This week" should exclude.
    slots: [
      { date: addDays(today, 8), time: "8:30 AM" },
      { date: addDays(today, 10), time: "1:00 PM" },
      { date: addDays(today, 11), time: "9:00 AM" },
      { date: addDays(today, 11), time: "11:30 AM" },
      { date: addDays(today, 12), time: "2:00 PM" },
      { date: addDays(today, 12), time: "3:30 PM" },
    ],
  },
  {
    initials: "PN", color: "#C2410C", name: "Priya Nair", business: "Nair Roofing & Exteriors",
    trade: "Roofer", miles: 6.3, rateFrom: 90,
    website: "nairroofing.com", location: "Lakewood, CO",
    services: ["Roof leak", "Gutter repair"],
    slots: [
      { date: addDays(today, 0), time: "5:00 PM" },
      { date: addDays(today, 4), time: "11:00 AM" },
      { date: addDays(today, 5), time: "11:30 AM" },
      { date: addDays(today, 5), time: "2:00 PM" },
      { date: addDays(today, 6), time: "10:15 AM" },
      { date: addDays(today, 6), time: "3:30 PM" },
    ],
  },
  {
    initials: "JS", color: "#4D7C0F", name: "Jake Sullivan", business: "Sullivan Lawn & Landscape",
    trade: "Landscaper", miles: 4.8, rateFrom: 50,
    website: "sullivanlawnlandscape.com", location: "Littleton, CO",
    services: ["Lawn mowing", "Tree trimming"],
    slots: [
      { date: addDays(today, 3), time: "8:00 AM" },
      { date: addDays(today, 5), time: "10:00 AM" },
      { date: addDays(today, 6), time: "2:00 PM" },
      { date: addDays(today, 6), time: "3:30 PM" },
      { date: addDays(today, 7), time: "10:15 AM" },
      { date: addDays(today, 7), time: "1:30 PM" },
    ],
  },
  {
    initials: "MG", color: "#0D9488", name: "Maria Gutierrez", business: "Gutierrez General Contracting",
    trade: "General Contractor", miles: 5.1, rateFrom: 120,
    website: "gutierrezgc.com", location: "Westminster, CO",
    services: ["Kitchen remodel", "Room addition"],
    slots: [
      { date: addDays(today, 0), time: "6:00 PM" },
      { date: addDays(today, 2), time: "9:00 AM" },
      { date: addDays(today, 3), time: "10:15 AM" },
      { date: addDays(today, 3), time: "3:30 PM" },
      { date: addDays(today, 4), time: "9:00 AM" },
      { date: addDays(today, 4), time: "1:30 PM" },
    ],
  },
  {
    initials: "CP", color: "#1D4ED8", name: "Chris Palmer", business: "Palmer Plumbing",
    trade: "Plumber", miles: 7.2, rateFrom: 70,
    website: "palmerplumbing.com", location: "Englewood, CO",
    services: ["No hot water", "Running toilet"],
    slots: [
      { date: addDays(today, 3), time: "2:00 PM" },
      { date: addDays(today, 4), time: "9:00 AM" },
      { date: addDays(today, 5), time: "10:15 AM" },
      { date: addDays(today, 5), time: "1:30 PM" },
      { date: addDays(today, 6), time: "9:00 AM" },
      { date: addDays(today, 6), time: "11:30 AM" },
    ],
  },
  {
    initials: "EZ", color: "#BE185D", name: "Emily Zhao", business: "Zhao Electric Co.",
    trade: "Electrician", miles: 2.1, rateFrom: 100,
    website: "zhaoelectricco.com", location: "Congress Park, Denver, CO",
    services: ["Breaker keeps tripping", "Flickering lights"],
    slots: [
      { date: addDays(today, 0), time: "12:30 PM" },
      { date: addDays(today, 0), time: "4:45 PM" },
      { date: addDays(today, 1), time: "9:00 AM" },
      { date: addDays(today, 1), time: "1:30 PM" },
      { date: addDays(today, 2), time: "11:30 AM" },
      { date: addDays(today, 2), time: "2:00 PM" },
    ],
  },
  {
    initials: "DO", color: "#0369A1", name: "Daniel Osei", business: "Osei HVAC Solutions",
    trade: "HVAC", miles: 3.9, rateFrom: 105,
    website: "oseihvac.com", location: "Stapleton, Denver, CO",
    services: ["AC not cooling", "Thermostat not responding"],
    slots: [
      { date: addDays(today, 0), time: "3:30 PM" },
      { date: addDays(today, 5), time: "8:00 AM" },
      { date: addDays(today, 6), time: "9:00 AM" },
      { date: addDays(today, 6), time: "11:30 AM" },
      { date: addDays(today, 7), time: "2:00 PM" },
      { date: addDays(today, 7), time: "3:30 PM" },
    ],
  },
  {
    initials: "HW", color: "#7C3AED", name: "Hannah Wright", business: "Wright Carpentry & Trim",
    trade: "Carpenter", miles: 1.5, rateFrom: 80,
    website: "wrightcarpentrytrim.com", location: "Berkeley, Denver, CO",
    services: ["Broken cabinet hinge", "Trim work"],
    slots: [
      { date: addDays(today, 0), time: "10:00 AM" },
      { date: addDays(today, 2), time: "1:00 PM" },
      { date: addDays(today, 3), time: "11:30 AM" },
      { date: addDays(today, 3), time: "2:00 PM" },
      { date: addDays(today, 4), time: "10:15 AM" },
      { date: addDays(today, 4), time: "3:30 PM" },
    ],
  },
];

/** How far ahead a listing's full calendar reaches: three pages of five days. */
export const CALENDAR_DAYS = 15;

const DAY_TIMES = ["8:00 AM", "9:00 AM", "10:30 AM", "12:00 PM", "1:30 PM", "3:00 PM", "4:30 PM"];

/**
 * Every time a sample listing has open, for the calendar behind "View all available times".
 *
 * The listed slots, with every day from tomorrow on filled out from DAY_TIMES, soonest first. The
 * card shows the first six of these, so its "next available" and the calendar always agree. Today
 * keeps only its listed times, which are the ones drawn in the "go" colour. The picks are seeded by
 * the name rather than random, so a listing shows the same week on every render and on the server
 * and the browser alike.
 */
export function scheduleFor(pro: Pro): ProSlot[] {
  let seed = [...pro.name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const all = [...pro.slots];
  for (let day = 1; day < CALENDAR_DAYS; day++) {
    const date = addDays(today, day);
    for (const time of DAY_TIMES) {
      seed = (seed * 9301 + 49297) % 233280;
      const listed = all.some((slot) => slot.time === time && differenceInCalendarDays(slot.date, date) === 0);
      if (!listed && seed / 233280 < 0.45) all.push({ date, time });
    }
  }
  return all.sort(
    (a, b) => differenceInCalendarDays(a.date, b.date) || minutesOf(a.time) - minutesOf(b.time)
  );
}

/** "1:30 PM" → 810, for ordering the times of one day. */
function minutesOf(time: string): number {
  const [, hours, minutes, half] = /^(\d+):(\d+) (AM|PM)$/.exec(time)!;
  return ((Number(hours) % 12) + (half === "PM" ? 12 : 0)) * 60 + Number(minutes);
}

// Trades actually present above, in first-appearance order — every trade
// filter this produces is guaranteed at least one result. Swap for the full
// TRADE_CATEGORIES list (components/profile/constants.ts) once this is
// backed by real listings instead of mock data.
export const TRADE_LIST = Array.from(new Set(PROS.map((p) => p.trade)));

// The handful of services each trade is most commonly booked for — powers
// the Service filter, whose options narrow to whichever trade(s) are picked.
// Not every service here has a listing behind it yet (same as any other
// filter combination) — that's a real "no matches" result, not a bug.
export const SERVICES_BY_TRADE: Record<string, string[]> = {
  Plumber: ["Leaking faucet", "No hot water", "Clogged drain", "Running toilet", "Burst pipe"],
  Electrician: ["Outlet not working", "Breaker keeps tripping", "Flickering lights", "Ceiling fan install", "Panel upgrade"],
  Carpenter: ["Broken cabinet hinge", "Squeaky floor", "Deck repair", "Shelving install", "Trim work"],
  Painter: ["Interior room repaint", "Peeling paint", "Exterior touch-up", "Cabinet refinishing", "Fence staining"],
  HVAC: ["Furnace won't start", "AC not cooling", "Thermostat not responding", "No airflow", "Annual tune-up"],
  Locksmith: ["Door won't lock", "Locked out", "Rekey the house", "Smart lock install", "Lost keys"],
  Handyman: ["Furniture assembly", "TV mounting", "Shelf installation", "Small repairs", "Drywall patching"],
  Roofer: ["Roof leak", "Missing shingles", "Gutter repair", "Storm damage", "Roof inspection"],
  Landscaper: ["Lawn mowing", "Seasonal cleanup", "Tree trimming", "Sprinkler repair", "Hedge trimming"],
  "General Contractor": ["Bathroom remodel", "Kitchen remodel", "Room addition", "Basement finishing", "General repairs"],
};

// One outline icon per trade, reused everywhere a trade is shown as a
// filter/tab rather than plain text (the homepage rail, the /browse filters).
export const TRADE_ICONS: Record<string, LucideIcon> = {
  All: LayoutGrid,
  Plumber: Droplet,
  Electrician: Zap,
  HVAC: Wind,
  Carpenter: Hammer,
  Locksmith: KeyRound,
  Handyman: Wrench,
  Painter: PaintRoller,
  Roofer: Home,
  Landscaper: Trees,
  "General Contractor": HardHat,
  "Auto Mechanic": Car,
  "Flooring Installer": Layers,
  "Industrial Mechanic": Cog,
  "Installation Technician": Plug,
  Mason: BrickWall,
  Artisan: Brush,
  "HVAC Technician": Wind,
  Handyperson: Wrench,
};
