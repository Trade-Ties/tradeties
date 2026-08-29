import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import { STEPS } from "./wizardSteps";

interface StepIndicatorProps {
  current: number;
  /**
   * Why every circle past the current one is sealed, or undefined when none of them is.
   *
   * The reason rather than a flag, because it is read out: it completes "locked until …" in the
   * accessible name, and this component knows only `STEPS`. One such reason is the Business step
   * being short of what `business_profile` needs; the primary trade gates the steps after it in
   * the same way, and neither must have to be spelled out here.
   *
   * The wizard refuses the jump either way, but a control that takes the click and does nothing
   * is worse than one that plainly cannot be clicked.
   */
  lockedReason?: string;
  onJump: (index: number) => void;
}

/**
 * The labels are positioned out of the flow on purpose: the circles are `shrink-0` and the text
 * is absolute, so only the connecting lines grow and nothing a label says can change how the
 * space is divided.
 *
 * The container's bottom padding is what the absolute labels hang in; removing it clips them.
 */
export function StepIndicator({ current, lockedReason, onJump }: StepIndicatorProps) {
  return (
    // No scroll container from `sm` up: the absolute labels overhang the first and last circle
    // by half their width, and inside a scrolling box that overhang counts as content and
    // produces a scrollbar for text that was never meant to move.
    <nav
      aria-label="Profile steps"
      className="flex items-center w-full pb-2 sm:pb-8 overflow-x-auto sm:overflow-visible"
    >
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isDone = i < current;
        const isActive = i === current;
        const isLast = i === STEPS.length - 1;
        const isLocked = lockedReason !== undefined && i > current;

        return (
          <div
            key={step.key}
            className={cn(
              "flex items-center",
              isLast ? "shrink-0" : "flex-1 min-w-[44px] sm:min-w-[72px]",
            )}
          >
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => onJump(i)}
                disabled={isLocked}
                // The visible label is the `span` below, which sits outside the button and is
                // hidden under `sm`, so it never names this control. It opens with the same
                // words the label shows, so what is read and what would be said to a voice
                // control match. The locked suffix is on the name rather than left to
                // `disabled`, which announces "unavailable" without saying what would lift it.
                aria-label={`${step.label}, step ${i + 1} of ${STEPS.length}${
                  isDone ? ", done" : isLocked ? `, locked until ${lockedReason}` : ""
                }`}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center border-2 transition-colors shrink-0",
                  isLocked && "cursor-not-allowed opacity-50",
                  isDone
                    ? "bg-primary border-primary text-primary-foreground"
                    : isActive
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground",
                )}
              >
                {isDone ? (
                  <Check aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Icon aria-hidden="true" className="h-4 w-4" />
                )}
              </button>
              <span
                // Decorative now that the button is named, or the word is read out twice.
                aria-hidden="true"
                className={cn(
                  "absolute left-1/2 top-full mt-1.5 w-20 -translate-x-1/2",
                  "text-xs text-center leading-tight hidden sm:block",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={cn("h-0.5 flex-1 mx-1", isDone ? "bg-primary" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
