import {
  CheckboxField,
  ChoiceField,
  FieldGrid,
  SelectField,
  toOptions,
} from "@/components/ui/field";
import {
  MINIMUM_BILLING_OPTIONS,
  BILLING_INCREMENT_OPTIONS,
  TRAVEL_FEE_MODES,
  MATERIAL_PRICING_MODES,
} from "../options";
import type { MaterialPricingMode, TravelFeeMode } from "@/lib/api/wire";
import { CountField, MoneyField, PercentField } from "../AmountField";
import { statesAnAmount } from "../toWire";
import type { PricingForm, StepProps } from "../types";

const BILLING_MINIMUMS = toOptions(MINIMUM_BILLING_OPTIONS, (m) => `${m} minutes`);
const BILLING_INCREMENTS = toOptions(BILLING_INCREMENT_OPTIONS, (m) => `${m} minutes`);

export function PricingStep({ data, update }: StepProps<PricingForm>) {
  // Whether there is a fee to waive, asked the way the wire asks it: a box holding a bare "."
  // is not empty but carries no amount, and the server refuses a waiver with no fee behind it.
  const hasCallFee = statesAnAmount(data.serviceCallFee);
  const chargesForTravel = data.travelFeeMode !== "INCLUDED";

  /**
   * Switching to "Included" takes the travel numbers with it: a rate left behind in a hidden
   * field is a rate that reaches the server saying the opposite of what the screen says. Same
   * reason the markup clears below, and the waiver clears when the fee it waives is deleted.
   */
  const selectTravelFeeMode = (travelFeeMode: TravelFeeMode) =>
    update(
      travelFeeMode === "INCLUDED"
        ? {
            ...data,
            travelFeeMode,
            travelFlatFee: "",
            travelRatePerMile: "",
            freeTravelRadiusMiles: "",
          }
        : { ...data, travelFeeMode }
    );

  const selectMaterialPricingMode = (materialPricingMode: MaterialPricingMode) =>
    update(
      materialPricingMode === "COST_PLUS_MARKUP"
        ? { ...data, materialPricingMode }
        : { ...data, materialPricingMode, materialMarkupPercent: "" }
    );

  return (
    <>
        <FieldGrid columns={3}>
          <MoneyField
            label="Hourly rate"
            hint="What a service priced by the hour bills at."
            value={data.hourlyRate}
            onValueChange={(hourlyRate) => update({ ...data, hourlyRate })}
          />

          <SelectField
            label="Minimum billing"
            required
            hint="The shortest visit you charge for."
            options={BILLING_MINIMUMS}
            value={data.minimumBillableMinutes}
            onValueChange={(minimumBillableMinutes) =>
              update({ ...data, minimumBillableMinutes })
            }
          />

          <SelectField
            label="Billing increment"
            required
            hint="Time past the minimum rounds up to this."
            options={BILLING_INCREMENTS}
            value={data.billingIncrementMinutes}
            onValueChange={(billingIncrementMinutes) =>
              update({ ...data, billingIncrementMinutes })
            }
          />
        </FieldGrid>

        <ChoiceField
          label="Travel charge"
          required
          columns={3}
          options={TRAVEL_FEE_MODES}
          value={data.travelFeeMode}
          onValueChange={selectTravelFeeMode}
        />

        <div className="space-y-3">
          <FieldGrid columns={3}>
            <MoneyField
              label="Service call fee"
              fieldClassName={chargesForTravel ? undefined : "sm:col-span-3"}
              hint="Charged for turning up, on top of the work."
              value={data.serviceCallFee}
              onValueChange={(serviceCallFee) => {
                update({
                  ...data,
                  serviceCallFee,
                  // Cleared to whatever no longer states a fee, not only to empty: the tick box
                  // below goes disabled either way, and a waiver left ticked behind a fee the
                  // wire reads as absent is refused for the whole step.
                  serviceCallFeeWaivedIfHired: statesAnAmount(serviceCallFee)
                    ? data.serviceCallFeeWaivedIfHired
                    : false,
                });
              }}
            />

            {data.travelFeeMode === "FLAT" && (
              <MoneyField
                label="Flat travel rate"
                required
                hint="One charge per job, whatever the distance."
                value={data.travelFlatFee}
                onValueChange={(travelFlatFee) => update({ ...data, travelFlatFee })}
              />
            )}

            {data.travelFeeMode === "PER_MILE" && (
              <MoneyField
                label="Rate per mile"
                required
                hint="Charged for every mile past the free ones."
                value={data.travelRatePerMile}
                onValueChange={(travelRatePerMile) => update({ ...data, travelRatePerMile })}
              />
            )}

            {chargesForTravel && (
              <CountField
                label="Free travel up to"
                suffix="mi"
                placeholder="0"
                // The width of the field's own `format: int32`, not a rule about how far anybody
                // drives: the contract states no maximum, so a value past what an `int` holds is
                // refused before any rule is consulted — as a 400 about the whole step.
                maxLength={9}
                hint="Distance you travel at no charge."
                value={data.freeTravelRadiusMiles}
                onValueChange={(freeTravelRadiusMiles) =>
                  update({ ...data, freeTravelRadiusMiles })
                }
              />
            )}
          </FieldGrid>

          <CheckboxField
            className="w-fit"
            label="Waive the service call fee if the client books the job"
            checked={data.serviceCallFeeWaivedIfHired}
            disabled={!hasCallFee}
            onCheckedChange={(serviceCallFeeWaivedIfHired) =>
              update({ ...data, serviceCallFeeWaivedIfHired })
            }
          />
        </div>

        <ChoiceField
          label="Material charge"
          required
          columns={2}
          options={MATERIAL_PRICING_MODES}
          value={data.materialPricingMode}
          onValueChange={selectMaterialPricingMode}
        />

        {data.materialPricingMode === "COST_PLUS_MARKUP" && (
          <PercentField
            label="Markup"
            required
            hint="Added to what the materials cost you."
            value={data.materialMarkupPercent}
            onValueChange={(materialMarkupPercent) =>
              update({ ...data, materialMarkupPercent })
            }
          />
        )}
    </>
  );
}
