import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ChevronRight, CircleAlert, Pencil } from "lucide-react";
import type { ProfileReadiness } from "@/lib/api/wire";
import { CollapsibleRow } from "../CollapsibleRow";
import type { FocusTargetName } from "../focusTarget";
import { CHECK_TARGETS } from "../wizardSteps";
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
  onJumpToStep: JumpToStep;
}

type JumpToStep = (stepKey: StepKey, field?: FocusTargetName) => void;

/**
 * The server's checklist, shown whole — the lines that pass included.
 *
 * The contract answers with all of them rather than only the failures, because a list that
 * showed only what is wrong cannot be ticked off, and "nothing left" would be indistinguishable
 * from "nothing checked". Each line is the server's own sentence rather than a wording here:
 * the conditions are the server's to decide and to phrase, and a second copy on this side is
 * the copy that goes stale.
 *
 * A line still open is a button to the field that settles it; a passed one has nowhere to send
 * anybody and stays plain text.
 */
function ReadinessChecklist({
  readiness,
  onJumpToStep,
}: {
  readiness: ProfileReadiness;
  onJumpToStep: JumpToStep;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <h3 className="pb-3 text-sm font-medium">
        {readiness.ready
          ? "Everything needed to go live is in place."
          : "Still to do before this profile can go live"}
      </h3>

      <ul className="space-y-2">
        {readiness.checks.map((check) =>
          check.passed ? (
            <li key={check.code} className="flex items-start gap-2 text-sm">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {/* The icon is the only thing that says which of the two a line is. */}
              <span className="sr-only">Done:</span>
              <span className="text-muted-foreground">{check.detail}</span>
            </li>
          ) : (
            <li key={check.code}>
              <button
                type="button"
                onClick={() => {
                  const target = CHECK_TARGETS[check.code];
                  onJumpToStep(target.step, target.field);
                }}
                className="group -mx-2 flex w-[calc(100%+1rem)] items-start gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span className="sr-only">Still open:</span>
                <span className="flex-1 underline-offset-2 group-hover:underline">{check.detail}</span>
                <ChevronRight
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
              </button>
            </li>
          )
        )}
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
      {readiness !== null && (
        <ReadinessChecklist readiness={readiness} onJumpToStep={onJumpToStep} />
      )}

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
