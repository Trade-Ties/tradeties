import { subDays } from "date-fns";

/**
 * Illustrative sample data for the Invoices tab. There is no invoicing or
 * payments concept anywhere in the API yet (see api/openapi.yaml) — this
 * exists to demo the shape that data will have once that backend exists.
 * See ../demo-data.ts for the same convention applied to appointments and
 * messages.
 */

const today = new Date(new Date().setHours(0, 0, 0, 0));

export type InvoiceStatus = "paid" | "pending" | "overdue";

export interface Invoice {
  id: string;
  number: string;
  customerName: string;
  service: string;
  issuedDate: Date;
  amount: number;
  status: InvoiceStatus;
}

export const DEMO_INVOICES: Invoice[] = [
  { id: "i1", number: "INV-1049", customerName: "Renee Holt", service: "Panel upgrade", issuedDate: subDays(today, 1), amount: 890, status: "pending" },
  { id: "i2", number: "INV-1048", customerName: "Victor Cruz", service: "Outlet install (x4)", issuedDate: subDays(today, 3), amount: 340, status: "pending" },
  { id: "i3", number: "INV-1047", customerName: "Amara Chukwu", service: "Water heater replacement", issuedDate: subDays(today, 4), amount: 1250, status: "paid" },
  { id: "i4", number: "INV-1046", customerName: "Noah Fischer", service: "Drain cleaning", issuedDate: subDays(today, 8), amount: 210, status: "paid" },
  { id: "i5", number: "INV-1045", customerName: "Ivy Blackwood", service: "Faucet install", issuedDate: subDays(today, 10), amount: 175, status: "paid" },
  { id: "i6", number: "INV-1041", customerName: "Sam Delgado", service: "Rewire — 2 rooms", issuedDate: subDays(today, 34), amount: 980, status: "overdue" },
  { id: "i7", number: "INV-1038", customerName: "Priya Shah", service: "Pipe repair", issuedDate: subDays(today, 41), amount: 260, status: "paid" },
];
