import { useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import type { ReferenceData, ServiceJob } from "@/lib/api/reference";
import { cn } from "@/lib/utils";
import { tradeName } from "./reference";

interface JobPickerProps {
  reference: ReferenceData;
  /** The trades claimed in step 3. A job under any other one could not be saved. */
  selectedTradeIds: string[];
  /** Catalogue ids already on the service list, saved or not. */
  offered: Set<string>;
  onPick: (job: ServiceJob) => void;
}

/**
 * The jobs a business can tick, and the reason step 4 needed one.
 *
 * Adding a service by hand means naming it, timing it and pricing it, so tradespeople add three
 * and stop — the seeded marketplace averages 3.1 each, for businesses that do thirty kinds of
 * work. A list that thin cannot be searched on: a plumber who never wrote "toilet" down is one
 * the customer with a leaking toilet never sees.
 *
 * **Ticking is meant to be cheap and reversible.** A tick appends a row below with the job's
 * name, an hour, and "I'll quote it" — all three editable there. Untick is deliberately not here:
 * removing a service can take a published profile off the market, and that question belongs on
 * the row itself rather than on a checkbox somebody is skimming.
 *
 * **Narrowed here rather than by the server.** The trades come from the screen before this one
 * and can change in the same sitting, so a list the server had already filtered would be stale
 * by the time it was read.
 */
export function JobPicker({ reference, selectedTradeIds, offered, onPick }: JobPickerProps) {
  const claimed = useMemo(() => new Set(selectedTradeIds), [selectedTradeIds]);

  /** Grouped by trade, in the order step 3 lists them, so the primary trade comes first. */
  const groups = useMemo(
    () =>
      selectedTradeIds
        .map((tradeId) => ({
          tradeId,
          label: tradeName(reference, tradeId),
          jobs: reference.serviceJobs.filter((job) => job.tradeId === tradeId),
        }))
        .filter((group) => group.label !== "" && group.jobs.length > 0),
    [reference, selectedTradeIds]
  );

  if (claimed.size === 0) {
    return (
      <p className="px-3 py-2 text-[13px] text-faint">
        Choose your trades in the previous step and the jobs people search for will show up here.
      </p>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="px-3 py-2 text-[13px] text-faint">
        Nothing catalogued for your trades yet. Add what you do below and we will name it.
      </p>
    );
  }

  return (
    <div className="max-h-80 overflow-y-auto overscroll-contain">
      {groups.map((group) => (
        <div key={group.tradeId} className="border-b border-line last:border-b-0">
          <p className="sticky top-0 bg-white px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-faint">
            {group.label}
          </p>
          <ul>
            {group.jobs.map((job) => {
              const already = offered.has(job.id);

              return (
                <li key={job.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[14px] hover:bg-brand-50",
                      already && "cursor-default text-faint hover:bg-transparent"
                    )}
                  >
                    <Checkbox
                      checked={already}
                      // Ticked and done. Taking a service off the list can unpublish a profile,
                      // so that decision lives on the row below where it can be answered.
                      disabled={already}
                      onCheckedChange={() => onPick(job)}
                    />
                    <span className="min-w-0 truncate">{job.label}</span>
                    {already && <span className="ml-auto shrink-0 text-[12px]">added</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
