import { Button } from "@/components/ui/button";
import { Check, Circle, Rocket } from "lucide-react";
import type { ProfileFormData } from "../types";

interface ChecklistItem {
  label: string;
  done: boolean;
  stepKey: string;
}

interface PublishStepProps {
  formData: ProfileFormData;
  onPublish: () => void;
  onSaveDraft: () => void;
  onJumpToStep: (stepKey: string) => void;
}

/**
 * Client-side completeness check.
 * Per the spec this should eventually come from the server — swap this
 * function for the API response once that endpoint exists.
 */
function buildChecklist(d: ProfileFormData): ChecklistItem[] {
  return [
    {
      label: "Business name, phone and email",
      done:
        d.business.legalName.trim() !== "" &&
        d.business.phone.trim() !== "" &&
        d.business.email.trim() !== "",
      stepKey: "business",
    },
    {
      label: "Service address and timezone",
      done:
        d.location.street.trim() !== "" &&
        d.location.city.trim() !== "" &&
        d.location.state !== "" &&
        d.location.zip.trim() !== "" &&
        d.location.timezone !== "",
      stepKey: "location",
    },
    {
      label: "Primary trade selected",
      done: d.trade.primaryTrade !== "",
      stepKey: "trade",
    },
    {
      label: "At least one service",
      done: d.services.some((s) => s.name.trim() !== ""),
      stepKey: "services",
    },
    {
      label: "Pricing set up",
      done: d.pricing.hourlyRate.trim() !== "" || d.services.some((s) => s.price.trim() !== ""),
      stepKey: "pricing",
    },
    {
      label: "At least one working day",
      done: Object.values(d.hours).some((day) => day.open && day.blocks.length > 0),
      stepKey: "hours",
    },
  ];
}

export function PublishStep({
  formData,
  onPublish,
  onSaveDraft,
  onJumpToStep,
}: PublishStepProps) {
  const checklist = buildChecklist(formData);
  const openItems = checklist.filter((c) => !c.done);
  const canPublish = openItems.length === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {canPublish
            ? "Everything's in place — your profile is ready to go live."
            : `${openItems.length} item${openItems.length === 1 ? "" : "s"} still need attention before you can publish.`}
        </p>

        <div className="space-y-1.5">
          {checklist.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => !item.done && onJumpToStep(item.stepKey)}
              disabled={item.done}
              className={[
                "flex items-center gap-3 w-full rounded-lg border p-3 text-left text-sm transition-colors",
                item.done
                  ? "border-muted cursor-default"
                  : "hover:border-muted-foreground/50 cursor-pointer",
              ].join(" ")}
            >
              {item.done ? (
                <span className="h-5 w-5 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                  <Check className="h-3.5 w-3.5 text-white" />
                </span>
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <span className={item.done ? "text-muted-foreground" : "font-medium"}>
                {item.label}
              </span>
              {!item.done && (
                <span className="ml-auto text-xs text-muted-foreground">Fix →</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t pt-5">
        <Button className="w-full" disabled={!canPublish} onClick={onPublish}>
          <Rocket className="h-4 w-4 mr-2" />
          Publish profile
        </Button>

        <button
          type="button"
          onClick={onSaveDraft}
          className="w-full text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          Publish later — save as draft
        </button>
      </div>
    </div>
  );
}
