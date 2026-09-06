import { subDays } from "date-fns";

/**
 * Illustrative sample data for the Insights tab — completed jobs and
 * expenses. There is no invoicing, payments, or bookkeeping concept
 * anywhere in the API yet (see api/openapi.yaml), so none of this is real.
 * It exists to demo the shape a business-performance view will have once
 * that backend exists. See ../demo-data.ts for the same convention applied
 * to appointments and messages.
 */

const today = new Date(new Date().setHours(0, 0, 0, 0));

export interface CompletedJob {
  id: string;
  customerName: string;
  service: string;
  date: Date;
  amount: number;
}

export const DEMO_COMPLETED_JOBS: CompletedJob[] = [
  { id: "j1", customerName: "Renee Holt", service: "Panel upgrade", date: subDays(today, 1), amount: 890 },
  { id: "j2", customerName: "Victor Cruz", service: "Outlet install (x4)", date: subDays(today, 3), amount: 340 },
  { id: "j3", customerName: "Amara Chukwu", service: "Water heater replacement", date: subDays(today, 4), amount: 1250 },
  { id: "j4", customerName: "Noah Fischer", service: "Drain cleaning", date: subDays(today, 8), amount: 210 },
  { id: "j5", customerName: "Ivy Blackwood", service: "Faucet install", date: subDays(today, 10), amount: 175 },
  { id: "j6", customerName: "Sam Delgado", service: "Rewire — 2 rooms", date: subDays(today, 14), amount: 980 },
  { id: "j7", customerName: "Priya Shah", service: "Pipe repair", date: subDays(today, 17), amount: 260 },
  { id: "j8", customerName: "Tom Reilly", service: "Water heater inspection", date: subDays(today, 22), amount: 150 },
  { id: "j9", customerName: "Grace Liu", service: "Breaker replacement", date: subDays(today, 26), amount: 320 },
  { id: "j10", customerName: "Ben Foster", service: "Outlet repair", date: subDays(today, 29), amount: 190 },
];

export interface Expense {
  id: string;
  label: string;
  date: Date;
  amount: number;
  category: string;
}

export const DEMO_EXPENSES: Expense[] = [
  { id: "e1", label: "Copper wire, 250ft spool", date: subDays(today, 2), amount: 210, category: "Materials" },
  { id: "e2", label: "Truck fuel", date: subDays(today, 5), amount: 84, category: "Vehicle" },
  { id: "e3", label: "Breaker panel parts", date: subDays(today, 9), amount: 165, category: "Materials" },
  { id: "e4", label: "Liability insurance — monthly", date: subDays(today, 12), amount: 145, category: "Insurance" },
  { id: "e5", label: "Permit fee — Denver", date: subDays(today, 20), amount: 75, category: "Permits" },
];
