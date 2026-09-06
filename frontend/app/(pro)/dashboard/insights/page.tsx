import { differenceInCalendarDays, format } from "date-fns";
import { DollarSign, Receipt, TrendingUp, Wrench } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "../StatTile";
import { DEMO_COMPLETED_JOBS, DEMO_EXPENSES } from "./insights-data";

const today = new Date(new Date().setHours(0, 0, 0, 0));
const money = (n: number) => `$${n.toLocaleString("en-US")}`;

// Buckets the last 6 weeks (this week first) so the chart always covers a
// rolling window rather than a hardcoded date range.
const WEEK_COUNT = 6;

export default function InsightsPage() {
  const revenue = DEMO_COMPLETED_JOBS.reduce((sum, j) => sum + j.amount, 0);
  const expenses = DEMO_EXPENSES.reduce((sum, e) => sum + e.amount, 0);
  const net = revenue - expenses;
  const avgJob = Math.round(revenue / DEMO_COMPLETED_JOBS.length);

  const weeklyRevenue = Array.from({ length: WEEK_COUNT }, () => 0);
  for (const job of DEMO_COMPLETED_JOBS) {
    const daysAgo = differenceInCalendarDays(today, job.date);
    const bucket = Math.floor(daysAgo / 7);
    if (bucket < WEEK_COUNT) weeklyRevenue[bucket] += job.amount;
  }
  const maxWeekly = Math.max(...weeklyRevenue, 1);

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <h1 className="mb-1 text-3xl font-bold tracking-[-0.02em] text-brand">Insights</h1>
      <p className="mb-8 text-muted-ink">
        Illustrative business performance — this will reflect real bookings and payments once
        those exist.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-3 min-[560px]:grid-cols-4">
        <StatTile icon={DollarSign} label="Revenue, last 30 days" value={money(revenue)} />
        <StatTile icon={Receipt} label="Expenses, last 30 days" value={money(expenses)} />
        <StatTile icon={TrendingUp} label="Net" value={money(net)} />
        <StatTile icon={Wrench} label="Avg. job value" value={money(avgJob)} />
      </div>

      <Card className="mb-4 gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
        <CardHeader className="px-5 pt-5">
          <CardTitle className="text-base font-semibold">Revenue by week</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex h-32 items-end gap-3">
            {weeklyRevenue
              .slice()
              .reverse()
              .map((amount, i) => {
                const weeksAgo = WEEK_COUNT - 1 - i;
                return (
                  <div key={weeksAgo} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-24 w-full items-end">
                      <div
                        className="w-full rounded-t-md bg-brand-500"
                        style={{ height: `${Math.max(6, (amount / maxWeekly) * 100)}%` }}
                        title={money(amount)}
                      />
                    </div>
                    <span className="text-[11px] text-faint">
                      {weeksAgo === 0 ? "This week" : `${weeksAgo}w ago`}
                    </span>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-base font-semibold">Completed jobs</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 px-5 pb-5">
            {DEMO_COMPLETED_JOBS.slice(0, 6).map((j) => (
              <div key={j.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{j.customerName}</p>
                  <p className="truncate text-xs text-muted-ink">
                    {j.service} · {format(j.date, "MMM d")}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-brand">{money(j.amount)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-base font-semibold">Expenses</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 px-5 pb-5">
            {DEMO_EXPENSES.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.label}</p>
                  <p className="truncate text-xs text-muted-ink">
                    {e.category} · {format(e.date, "MMM d")}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-muted-ink">-{money(e.amount)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
