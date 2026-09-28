import { DollarSign, Receipt, TrendingUp, Wrench } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComingSoonPage, EmptyRows } from "../ComingSoon";
import { StatTile } from "../StatTile";

// The shape the chart will have: one column per week, this week last.
const WEEK_LABELS = ["5w ago", "4w ago", "3w ago", "2w ago", "1w ago", "This week"];

export default function InsightsPage() {
  return (
    <ComingSoonPage
      title="Insights"
      description="See how your business is doing — revenue, expenses and your busiest weeks, worked out from your bookings and payments."
    >
      <div className="mb-6 grid grid-cols-1 gap-3 min-[560px]:grid-cols-4">
        <StatTile icon={DollarSign} label="Revenue, last 30 days" value="—" />
        <StatTile icon={Receipt} label="Expenses, last 30 days" value="—" />
        <StatTile icon={TrendingUp} label="Net" value="—" />
        <StatTile icon={Wrench} label="Avg. job value" value="—" />
      </div>

      <Card className="mb-4 gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
        <CardHeader className="px-5 pt-5">
          <CardTitle className="text-base font-semibold">Revenue by week</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex h-32 items-end gap-3">
            {WEEK_LABELS.map((label) => (
              <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-24 w-full items-end">
                  <div className="h-1.5 w-full rounded-t-md bg-line" />
                </div>
                <span className="text-[11px] text-faint">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-base font-semibold">Completed jobs</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <EmptyRows>No completed jobs yet.</EmptyRows>
          </CardContent>
        </Card>

        <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-base font-semibold">Expenses</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <EmptyRows>No expenses yet.</EmptyRows>
          </CardContent>
        </Card>
      </div>
    </ComingSoonPage>
  );
}
