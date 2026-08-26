import {
  ChoiceField,
  FieldGrid,
  SelectField,
  TextareaField,
  toOptions,
} from "@/components/ui/field";
import type { ChoiceOption } from "@/components/ui/field";
import { CANCELLATION_POLICIES, CANCELLATION_WINDOW_OPTIONS } from "../options";
import { MoneyField } from "../AmountField";
import type { CancellationPolicy, PricingForm, StepProps, UiState } from "../types";

/**
 * The tiles, written out of the shared policy table. Only the description lives here — the
 * notice is derived, so the tile and the publish review cannot quote different numbers.
 */
const POLICIES: ChoiceOption<CancellationPolicy>[] = CANCELLATION_POLICIES.map(
  ({ value, label, hours }) => ({
    value,
    label,
    desc:
      hours === null
        ? "Set your own window"
        : `Free cancellation up to ${hours} hours before`,
  })
);

const WINDOW_OPTIONS = toOptions(CANCELLATION_WINDOW_OPTIONS, (h) => `${h} hours`);

/**
 * The cancellation terms, which live on the pricing resource.
 *
 * Two slices, because two different things are edited. `data` is the contract's own fields — the
 * fee and the notice in hours — and goes to the server unchanged. `ui` holds which named policy
 * is selected, which cannot be derived from the hours: "Flexible" means 24, but so can "Custom".
 */
interface CancellationStepProps extends StepProps<PricingForm> {
  ui: UiState;
  updateUi: (value: UiState) => void;
}

export function CancellationStep({ data, update, ui, updateUi }: CancellationStepProps) {
  const isCustom = ui.cancellationPolicy === "custom";

  /**
   * Picking a named policy sets the hours it stands for; picking "Custom" changes nothing but
   * the label, and reveals the dropdown that edits the hours directly. Either way there is one
   * number stored, which is the one the contract takes.
   */
  const selectPolicy = (cancellationPolicy: CancellationPolicy) => {
    updateUi({ ...ui, cancellationPolicy });

    const hours = CANCELLATION_POLICIES.find((p) => p.value === cancellationPolicy)?.hours;
    if (hours !== null && hours !== undefined) {
      update({ ...data, cancellationNoticeHours: hours });
    }
  };

  return (
    <>
      <ChoiceField
        label="Cancellation policy"
        required
        columns={2}
        options={POLICIES}
        value={ui.cancellationPolicy}
        onValueChange={selectPolicy}
      />

      <FieldGrid columns={2}>
        <MoneyField
          label="Cancellation fee"
          fieldClassName={isCustom ? undefined : "sm:col-span-2"}
          required
          hint="Charged when a client cancels too late. 0 for none."
          value={data.cancellationFee}
          onValueChange={(cancellationFee) => update({ ...data, cancellationFee })}
        />

        {isCustom && (
          <SelectField
            label="Cancellation window"
            required
            hint="Free cancellation before this cutoff."
            options={WINDOW_OPTIONS}
            value={data.cancellationNoticeHours}
            onValueChange={(cancellationNoticeHours) =>
              update({ ...data, cancellationNoticeHours })
            }
          />
        )}
      </FieldGrid>

      {/* No field behind it. The contract has nowhere to put this, so it is typed and then
          dropped on save — see `UiState`, where the gap is named. */}
      <TextareaField
        label="Additional notes"
        rows={3}
        hint="Shown to clients before they book. Not saved yet."
        value={ui.cancellationNotes}
        onChange={(e) => updateUi({ ...ui, cancellationNotes: e.target.value })}
      />
    </>
  );
}
