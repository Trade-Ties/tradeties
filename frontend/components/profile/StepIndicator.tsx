import { Check } from "lucide-react";
import { STEPS } from "./constants";

interface StepIndicatorProps {
  current: number;
  onJump: (index: number) => void;
}

export function StepIndicator({ current, onJump }: StepIndicatorProps) {
  return (
    <div className="flex items-center w-full overflow-x-auto pb-2">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isDone = i < current;
        const isActive = i === current;
        return (
          <div key={step.key} className="flex items-center flex-1 min-w-[90px]">
            <div className="flex flex-col items-center gap-1 flex-1">
              <button
                type="button"
                onClick={() => onJump(i)}
                className={[
                  "h-9 w-9 rounded-full flex items-center justify-center border-2 transition-colors shrink-0",
                  isDone
                    ? "bg-primary border-primary text-primary-foreground"
                    : isActive
                    ? "border-primary text-primary"
                    : "border-muted text-muted-foreground",
                ].join(" ")}
              >
                {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </button>
              <span
                className={[
                  "text-xs text-center leading-tight hidden sm:block",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={["h-0.5 flex-1 mx-1", isDone ? "bg-primary" : "bg-muted"].join(" ")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
