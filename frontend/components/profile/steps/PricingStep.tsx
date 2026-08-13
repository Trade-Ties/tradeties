import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FieldRow } from "../FieldRow";
import {
  MINIMUM_BILLING_OPTIONS,
  BILLING_INCREMENT_OPTIONS,
  TRAVEL_MODELS,
  MATERIAL_MODELS,
} from "../constants";
import type { StepProps, PricingInfo, TravelModel, MaterialModel } from "../types";

/** Strips anything that isn't a digit or decimal point. */
const money = (v: string) => v.replace(/[^\d.]/g, "");

function CurrencyInput({
  value,
  onChange,
  placeholder = "0.00",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
        $
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(money(e.target.value))}
        placeholder={placeholder}
        inputMode="decimal"
        className="pl-7"
      />
    </div>
  );
}

export function PricingStep({ data, update }: StepProps<PricingInfo>) {
  const hasCallFee = data.serviceCallFee.trim() !== "";

  return (
    <div className="space-y-6">
      {/* --- Labor -------------------------------------------------- */}
      <div className="space-y-4">
        <FieldRow label="Hourly rate">
          <CurrencyInput
            value={data.hourlyRate}
            onChange={(v) => update({ ...data, hourlyRate: v })}
          />
        </FieldRow>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Minimum billing *">
            <Select
              value={String(data.minimumBillingMinutes)}
              onValueChange={(v) =>
                update({ ...data, minimumBillingMinutes: Number(v ?? 60) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINIMUM_BILLING_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Billing increment *">
            <Select
              value={String(data.billingIncrementMinutes)}
              onValueChange={(v) =>
                update({ ...data, billingIncrementMinutes: Number(v ?? 15) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_INCREMENT_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      </div>

      {/* --- Travel ------------------------------------------------- */}
      <div className="space-y-4 border-t pt-5">
        <FieldRow label="Service call fee">
          <CurrencyInput
            value={data.serviceCallFee}
            onChange={(v) =>
              update({
                ...data,
                serviceCallFee: v,
                // clear the waiver if the fee itself is removed
                waiveCallFeeOnBooking: v.trim() === "" ? false : data.waiveCallFeeOnBooking,
              })
            }
          />
        </FieldRow>

        <label
          className={[
            "flex items-center gap-2 text-sm",
            hasCallFee ? "cursor-pointer" : "opacity-50 cursor-not-allowed",
          ].join(" ")}
        >
          <Checkbox
            checked={data.waiveCallFeeOnBooking}
            disabled={!hasCallFee}
            onCheckedChange={(v) => update({ ...data, waiveCallFeeOnBooking: v === true })}
          />
          Waive the service call fee if the client books the job
        </label>

        <FieldRow label="Travel charge *">
          <RadioGroup
            value={data.travelModel}
            onValueChange={(v) =>
              update({ ...data, travelModel: (v ?? "included") as TravelModel })
            }
            className="space-y-2"
          >
            {TRAVEL_MODELS.map((m) => (
              <div key={m.value} className="flex items-start gap-3 rounded-lg border p-3">
                <RadioGroupItem value={m.value} id={`travel-${m.value}`} className="mt-1" />
                <Label htmlFor={`travel-${m.value}`} className="font-normal flex-1">
                  <span className="font-medium block">{m.label}</span>
                  <span className="text-sm text-muted-foreground">{m.desc}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </FieldRow>

        {data.travelModel === "flat" && (
          <FieldRow label="Flat travel rate *">
            <CurrencyInput
              value={data.travelFlatRate}
              onChange={(v) => update({ ...data, travelFlatRate: v })}
            />
          </FieldRow>
        )}

        {data.travelModel === "perMile" && (
          <FieldRow label="Rate per mile *">
            <CurrencyInput
              value={data.travelPerMile}
              onChange={(v) => update({ ...data, travelPerMile: v })}
            />
          </FieldRow>
        )}

        <FieldRow label="Free travel up to" hint="Distance you travel at no charge">
          <div className="relative w-40">
            <Input
              value={data.freeTravelMiles}
              onChange={(e) =>
                update({ ...data, freeTravelMiles: e.target.value.replace(/[^\d]/g, "") })
              }
              placeholder="0"
              inputMode="numeric"
              className="pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              mi
            </span>
          </div>
        </FieldRow>
      </div>

      {/* --- Materials ---------------------------------------------- */}
      <div className="space-y-4 border-t pt-5">
        <FieldRow label="Materials *">
          <RadioGroup
            value={data.materialModel}
            onValueChange={(v) =>
              update({ ...data, materialModel: (v ?? "included") as MaterialModel })
            }
            className="space-y-2"
          >
            {MATERIAL_MODELS.map((m) => (
              <div key={m.value} className="flex items-start gap-3 rounded-lg border p-3">
                <RadioGroupItem value={m.value} id={`material-${m.value}`} className="mt-1" />
                <Label htmlFor={`material-${m.value}`} className="font-normal flex-1">
                  <span className="font-medium block">{m.label}</span>
                  <span className="text-sm text-muted-foreground">{m.desc}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </FieldRow>

        {data.materialModel === "costPlus" && (
          <FieldRow label="Markup *">
            <div className="relative w-40">
              <Input
                value={data.materialMarkupPercent}
                onChange={(e) =>
                  update({
                    ...data,
                    materialMarkupPercent: e.target.value.replace(/[^\d.]/g, ""),
                  })
                }
                placeholder="15"
                inputMode="decimal"
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                %
              </span>
            </div>
          </FieldRow>
        )}
      </div>

    </div>
  );
}
