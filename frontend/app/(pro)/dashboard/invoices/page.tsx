import { format } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, FileClock, FileWarning } from "lucide-react";
import { StatTile } from "../StatTile";
import { DEMO_INVOICES, type InvoiceStatus } from "./invoices-data";

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

const STATUS_LOOK: Record<InvoiceStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-go-bg text-[#07734F]" },
  pending: { label: "Pending", className: "bg-brand-50 text-brand-500" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive" },
};

export default function InvoicesPage() {
  const outstanding = DEMO_INVOICES.filter((i) => i.status !== "paid").reduce((sum, i) => sum + i.amount, 0);
  const overdueCount = DEMO_INVOICES.filter((i) => i.status === "overdue").length;
  const paidTotal = DEMO_INVOICES.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <h1 className="mb-1 text-3xl font-bold tracking-[-0.02em] text-brand">Invoices</h1>
      <p className="mb-8 text-muted-ink">
        Illustrative billing history — there is no payments backend yet, so nothing here is real.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-3 min-[560px]:grid-cols-3">
        <StatTile icon={DollarSign} label="Outstanding" value={money(outstanding)} />
        <StatTile icon={FileWarning} label="Overdue" value={overdueCount} unit="invoice" accent />
        <StatTile icon={FileClock} label="Paid, last 60 days" value={money(paidTotal)} />
      </div>

      <Card className="gap-0 rounded-3xl border border-line bg-white py-2 shadow-card">
        <CardContent className="flex flex-col px-2">
          {DEMO_INVOICES.map((invoice) => {
            const status = STATUS_LOOK[invoice.status];
            return (
              <div
                key={invoice.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl px-3.5 py-3 hover:bg-brand-50/60"
              >
                <span className="w-[92px] shrink-0 font-mono text-xs text-faint">{invoice.number}</span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invoice.customerName}</p>
                  <p className="truncate text-xs text-muted-ink">{invoice.service}</p>
                </div>

                <span className="shrink-0 text-xs text-muted-ink">{format(invoice.issuedDate, "MMM d, yyyy")}</span>

                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>
                  {status.label}
                </span>

                <span className="w-[72px] shrink-0 text-right text-sm font-semibold text-brand">
                  {money(invoice.amount)}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
