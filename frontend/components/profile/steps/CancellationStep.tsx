import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldRow } from "../FieldRow";
import { CANCELLATION_WINDOW_OPTIONS } from "../constants";
import type { StepProps, CancellationInfo } from "../types";

const POLICIES: [CancellationInfo["policy"], string, string][] = [
  ["flexible", "Flexible", "Free cancellation up to 24 hours before"],
  ["moderate", "Moderate", "Free cancellation up to 48 hours before"],
  ["strict", "Strict", "Free cancellation up to 72 hours before"],
  ["custom", "Custom", "Set your own window"],
];

export function CancellationStep({ data, update }: StepProps<CancellationInfo>) {
  return (
    <div className="space-y-5">
      <FieldRow label="Cancellation policy *">
        <RadioGroup
          value={data.policy}
          onValueChange={(v) =>
            update({ ...data, policy: (v ?? "flexible") as CancellationInfo["policy"] })
          }
          className="space-y-2"
        >
          {POLICIES.map(([value, label, desc]) => (
            <div key={value} className="flex items-start gap-3 rounded-lg border p-3">
              <RadioGroupItem value={value} id={`policy-${value}`} className="mt-1" />
              <Label htmlFor={`policy-${value}`} className="font-normal flex-1">
                <span className="font-medium block">{label}</span>
                <span className="text-sm text-muted-foreground">{desc}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </FieldRow>

      {data.policy === "custom" && (
        <FieldRow label="Cancellation window *" hint="Free cancellation before this cutoff">
          <Select
            value={String(data.windowHours)}
            onValueChange={(v) => update({ ...data, windowHours: Number(v ?? 24) })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANCELLATION_WINDOW_OPTIONS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {h} hours
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
      )}

      <FieldRow
        label="Cancellation fee *"
        hint="Charged when a client cancels after the cutoff. Leave at 0 for no fee."
      >
        <div className="relative w-40">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            $
          </span>
          <Input
            value={data.fee}
            onChange={(e) => update({ ...data, fee: e.target.value.replace(/[^\d.]/g, "") })}
            placeholder="0.00"
            inputMode="decimal"
            className="pl-7"
          />
        </div>
      </FieldRow>

      <FieldRow label="Additional notes" hint="Optional — shown to clients before they book">
        <Textarea
          value={data.notes}
          onChange={(e) => update({ ...data, notes: e.target.value })}
          rows={3}
        />
      </FieldRow>
    </div>
  );
}
