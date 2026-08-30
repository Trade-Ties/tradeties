import { addDays } from "date-fns";
import {
  Droplet,
  Hammer,
  HardHat,
  Home,
  KeyRound,
  LayoutGrid,
  PaintRoller,
  Trees,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

// Shared mock listing data — used by both the homepage's availability rail
// (a short teaser) and the full /browse page (the whole list, filterable).
// Single source of truth so a pro's rating/rate/miles can't drift between
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
  rating: number;
  jobs: number;
  miles: number;
  /** Hourly starting rate, in USD — what the profile lists as its base rate. */
  rateFrom: number;
  /** Identity-verification status — Licensed is shown for every listing; this gates the second trust badge. */
  verified: boolean;
  /** What this pro is listed for — a subset of SERVICES_BY_TRADE[trade], drives the Service filter. */
  services: string[];
  slots: ProSlot[];
}

export const PROS: Pro[] = [
  {
    initials: "MW", color: "#1E4E82", name: "Marcus Webb", business: "Webb Plumbing Co.",
    trade: "Plumber", rating: 4.9, jobs: 312, miles: 2.4, rateFrom: 85, verified: true,
    services: ["Leaking faucet", "Clogged drain"],
    slots: [
      { date: addDays(today, 0), time: "2:15 PM" },
      { date: addDays(today, 0), time: "4:00 PM" },
      { date: addDays(today, 0), time: "5:30 PM" },
    ],
  },
  {
    initials: "DA", color: "#0E9F6E", name: "Denise Alvarez", business: "Front Range Electric",
    trade: "Electrician", rating: 4.8, jobs: 207, miles: 3.1, rateFrom: 95, verified: true,
    services: ["Outlet not working", "Panel upgrade"],
    slots: [
      { date: addDays(today, 0), time: "3:00 PM" },
      { date: addDays(today, 0), time: "6:15 PM" },
    ],
  },
  {
    initials: "RO", color: "#B4530A", name: "Ray Okonkwo", business: "Okonkwo Heating & Air",
    trade: "HVAC", rating: 5.0, jobs: 89, miles: 5.7, rateFrom: 110, verified: true,
    services: ["Furnace won't start", "Annual tune-up"],
    slots: [
      { date: addDays(today, 3), time: "8:00 AM" },
      { date: addDays(today, 3), time: "10:30 AM" },
    ],
  },
  {
    initials: "TB", color: "#0A2F5C", name: "Tom Brennan", business: "Brennan Carpentry",
    trade: "Carpenter", rating: 4.7, jobs: 156, miles: 4.2, rateFrom: 75, verified: false,
    services: ["Deck repair", "Shelving install"],
    slots: [
      { date: addDays(today, 1), time: "9:00 AM" },
      { date: addDays(today, 3), time: "1:00 PM" },
    ],
  },
  {
    initials: "AP", color: "#6D3FA8", name: "Ana Petrova", business: "Keystone Lock & Key",
    trade: "Locksmith", rating: 4.9, jobs: 431, miles: 1.8, rateFrom: 65, verified: true,
    services: ["Door won't lock", "Locked out"],
    slots: [
      { date: addDays(today, 0), time: "1:45 PM" },
      { date: addDays(today, 0), time: "7:00 PM" },
    ],
  },
  {
    initials: "LR", color: "#B91C1C", name: "Luis Ramirez", business: "Ramirez Home Repair",
    trade: "Handyman", rating: 4.8, jobs: 264, miles: 3.6, rateFrom: 60, verified: true,
    services: ["Furniture assembly", "Small repairs"],
    slots: [
      { date: addDays(today, 0), time: "4:30 PM" },
      { date: addDays(today, 3), time: "9:00 AM" },
    ],
  },
  {
    initials: "SK", color: "#CA8A04", name: "Sofia Kim", business: "Kim & Sons Painting",
    trade: "Painter", rating: 4.9, jobs: 198, miles: 2.9, rateFrom: 55, verified: true,
    services: ["Interior room repaint", "Cabinet refinishing"],
    // Deliberately outside the 7-day window — the only listing "This week" should exclude.
    slots: [
      { date: addDays(today, 8), time: "8:30 AM" },
      { date: addDays(today, 10), time: "1:00 PM" },
    ],
  },
  {
    initials: "PN", color: "#C2410C", name: "Priya Nair", business: "Nair Roofing & Exteriors",
    trade: "Roofer", rating: 4.6, jobs: 143, miles: 6.3, rateFrom: 90, verified: false,
    services: ["Roof leak", "Gutter repair"],
    slots: [
      { date: addDays(today, 0), time: "5:00 PM" },
      { date: addDays(today, 4), time: "11:00 AM" },
    ],
  },
  {
    initials: "JS", color: "#4D7C0F", name: "Jake Sullivan", business: "Sullivan Lawn & Landscape",
    trade: "Landscaper", rating: 4.7, jobs: 176, miles: 4.8, rateFrom: 50, verified: true,
    services: ["Lawn mowing", "Tree trimming"],
    slots: [
      { date: addDays(today, 3), time: "8:00 AM" },
      { date: addDays(today, 5), time: "10:00 AM" },
    ],
  },
  {
    initials: "MG", color: "#0D9488", name: "Maria Gutierrez", business: "Gutierrez General Contracting",
    trade: "General Contractor", rating: 4.9, jobs: 98, miles: 5.1, rateFrom: 120, verified: true,
    services: ["Kitchen remodel", "Room addition"],
    slots: [
      { date: addDays(today, 0), time: "6:00 PM" },
      { date: addDays(today, 2), time: "9:00 AM" },
    ],
  },
  {
    initials: "CP", color: "#1D4ED8", name: "Chris Palmer", business: "Palmer Plumbing",
    trade: "Plumber", rating: 4.6, jobs: 87, miles: 7.2, rateFrom: 70, verified: false,
    services: ["No hot water", "Running toilet"],
    slots: [
      { date: addDays(today, 3), time: "2:00 PM" },
      { date: addDays(today, 4), time: "9:00 AM" },
    ],
  },
  {
    initials: "EZ", color: "#BE185D", name: "Emily Zhao", business: "Zhao Electric Co.",
    trade: "Electrician", rating: 5.0, jobs: 342, miles: 2.1, rateFrom: 100, verified: true,
    services: ["Breaker keeps tripping", "Flickering lights"],
    slots: [
      { date: addDays(today, 0), time: "12:30 PM" },
      { date: addDays(today, 0), time: "4:45 PM" },
    ],
  },
  {
    initials: "DO", color: "#0369A1", name: "Daniel Osei", business: "Osei HVAC Solutions",
    trade: "HVAC", rating: 4.8, jobs: 211, miles: 3.9, rateFrom: 105, verified: true,
    services: ["AC not cooling", "Thermostat not responding"],
    slots: [
      { date: addDays(today, 0), time: "3:30 PM" },
      { date: addDays(today, 5), time: "8:00 AM" },
    ],
  },
  {
    initials: "HW", color: "#7C3AED", name: "Hannah Wright", business: "Wright Carpentry & Trim",
    trade: "Carpenter", rating: 4.9, jobs: 129, miles: 1.5, rateFrom: 80, verified: true,
    services: ["Broken cabinet hinge", "Trim work"],
    slots: [
      { date: addDays(today, 0), time: "10:00 AM" },
      { date: addDays(today, 2), time: "1:00 PM" },
    ],
  },
];

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
};
