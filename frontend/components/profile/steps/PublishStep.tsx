import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, CircleAlert, Pencil } from "lucide-react";
import type { ProfileReadiness } from "@/lib/api/wire";
import { CollapsibleRow } from "../CollapsibleRow";
import { missingIn } from "../review";
import type { ReviewGroup } from "../review";
import type { StepKey } from "../types";

interface PublishStepProps {
  review: ReviewGroup[];
  /**
   * The server's checklist, or null when there is none to show — no business yet, or the read
   * did not come back. See `ProfileWizard.readiness`.
   */
  readiness: ProfileReadiness | null;
  onJumpToStep: (stepKey: StepKey) => void;
}

/**
 * The server's checklist, shown whole — the lines that pass included.
 *
 * The contract answers with all of them rather than only the failures, because a list that
 * showed only what is wrong cannot be ticked off, and "nothing left" would be indistinguishable
 * from "nothing checked". Each line is the server's own sentence rather than a wording here:
 * every condition behind it reads from more than one table, and a second copy on this side is
 * the copy that goes stale.
 */
function ReadinessChecklist({ readiness }: { readiness: ProfileReadiness }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <h3 className="pb-3 text-sm font-medium">
        {readiness.ready
          ? "Everything needed to go live is in place."
          : "Still to do before this profile can go live"}
      </h3>

      <ul className="space-y-2">
        {readiness.checks.map((check) => (
          <li key={check.code} className="flex items-start gap-2 text-sm">
            {check.passed ? (
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            ) : (
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
            )}
            {/* The icon is the only thing that says which of the two a line is. */}
            <span className="sr-only">{check.passed ? "Done:" : "Still open:"}</span>
            <span className={check.passed ? "text-muted-foreground" : undefined}>
              {check.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The last step: the server's checklist, and under it what was entered read back group by group.
 *
 * The two answer different questions and both are shown. The checklist is about what is
 * *stored* — it is what the publish button obeys, and where the two disagree the server decides.
 * The review below reads the form and says what somebody entered, marking what is missing where
 * it is missing: a `n missing` on the group that holds it, a `Required` badge on the row.
 *
 * The publish button itself is not here. It lives in the wizard's footer, which stays put while
 * this scrolls.
 */
export function PublishStep({ review, readiness, onJumpToStep }: PublishStepProps) {
  const [openKeys, setOpenKeys] = useState<StepKey[]>([]);

  const toggle = (stepKey: StepKey) =>
    setOpenKeys((keys) =>
      keys.includes(stepKey) ? keys.filter((k) => k !== stepKey) : [...keys, stepKey]
    );

  return (
    <div className="space-y-4">
      {readiness !== null && <ReadinessChecklist readiness={readiness} />}

      <div className="space-y-2">
        {review.map((group) => {
          const isOpen = openKeys.includes(group.stepKey);
          const open = missingIn(group);

          return (
            <CollapsibleRow
              key={group.stepKey}
              panelId={`review-${group.stepKey}`}
              open={isOpen}
              onToggle={() => toggle(group.stepKey)}
              title={group.title}
              problem={open > 0 ? `${open} missing` : null}
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground"
                  aria-label={`Edit ${group.title}`}
                  onClick={() => onJumpToStep(group.stepKey)}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              }
              panelClassName="divide-y px-4 text-sm"
            >
              {group.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-4 py-2.5"
                >
                  <span className="shrink-0 text-muted-foreground">{row.label}</span>
                  {row.value === "" ? (
                    <Badge variant="destructive">Required</Badge>
                  ) : (
                    <span className="min-w-0 text-right font-medium">{row.value}</span>
                  )}
                </div>
              ))}
            </CollapsibleRow>
          );
        })}
      </div>
    </div>
  );
}
