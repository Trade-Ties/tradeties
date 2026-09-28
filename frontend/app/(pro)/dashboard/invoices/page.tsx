import { DollarSign, FileClock, FileWarning } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ComingSoonPage, EmptyRows } from "../ComingSoon";
import { StatTile } from "../StatTile";

export default function InvoicesPage() {
  return (
    <ComingSoonPage
      title="Invoices"
      description="Send invoices for finished jobs, get paid online and see what is still outstanding."
    >
      <div className="mb-6 grid grid-cols-1 gap-3 min-[560px]:grid-cols-3">
        <StatTile icon={DollarSign} label="Outstanding" value="—" />
        <StatTile icon={FileWarning} label="Overdue" value="—" />
        <StatTile icon={FileClock} label="Paid, last 60 days" value="—" />
      </div>

      <Card className="gap-0 rounded-3xl border border-line bg-white py-0 shadow-card">
        <CardContent className="p-5">
          <EmptyRows>No invoices yet.</EmptyRows>
        </CardContent>
      </Card>
    </ComingSoonPage>
  );
}
