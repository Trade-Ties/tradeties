import { Slider } from "@/components/ui/slider";
import { AutocompleteField, Field, FieldGrid, TextField } from "@/components/ui/field";
import type { ReferenceData } from "@/lib/api/reference";
import { DIGIT, useCaret } from "../caret";
import { FIELD_MAX } from "../limits";
import { format as formatPostalCode } from "../postalCode";
import { stateName, stateOptions, timeZoneName, timeZoneOptions } from "../reference";
import { isSplitState, zoneForState } from "../stateTimeZones";
import { useTouched } from "../touched";
import type { AddressForm, ProfileForm, StepProps } from "../types";
import { postalCodeProblem } from "../validate";
import { FocusTarget } from "../focusTarget";

interface LocationStepProps extends StepProps<ProfileForm> {
  reference: ReferenceData;
}

export function LocationStep({ data, update, reference }: LocationStepProps) {
  /** The address is nested on the profile, as it is on the wire — one setter for its parts. */
  const setAddress = (next: Partial<AddressForm>) =>
    update({ ...data, address: { ...data.address, ...next } });

  const { touch, settled } = useTouched();
  /** The ZIP box inserts the dash of a ZIP+4, so the caret has to be put back — see `caret.ts`. */
  const keepCaret = useCaret();

  // `AutocompleteControl` memoises its items on array identity, so these must not be rebuilt
  // on every keystroke of the address above.
  const states = stateOptions(reference);
  const timeZones = timeZoneOptions(reference);

  /**
   * The state brings its time zone with it, as long as the zone is still the one the state
   * suggested — or none yet. One picked by hand stays: the tradesperson knew better.
   */
  const pickState = (state: string) => {
    const followsState = data.timeZone === "" || data.timeZone === zoneForState(data.address.state);
    const suggested = zoneForState(state);

    update({
      ...data,
      address: { ...data.address, state },
      timeZone: followsState && suggested !== "" ? suggested : data.timeZone,
    });
  };

  const state = data.address.state;
  const fromState = data.timeZone !== "" && data.timeZone === zoneForState(state);
  const zoneHint =
    data.timeZone === ""
      ? "Filled in once you pick your state."
      : fromState && isSplitState(state)
        ? `Most of ${stateName(reference, state)} is on ${timeZoneName(reference, data.timeZone)}. Change it if you're in the part that isn't.`
        : fromState
          ? "Filled in from your state. Booking times are shown in this time zone."
          : "Booking times are shown in this time zone.";

  return (
    <>
      {/* The contract's own `Address` lengths on the boxes that take them. A paste past one of
          them is a 400 for the whole step whose message is "Invalid request content.", naming
          neither the field nor the length — and nothing else between here and the column
          mentions them. */}
      <FieldGrid columns={4}>
        <TextField
          label="Address"
          required
          autoComplete="address-line1"
          fieldClassName="sm:col-span-2"
          value={data.address.street1}
          maxLength={FIELD_MAX.street}
          onChange={(e) => setAddress({ street1: e.target.value })}
        />

        <TextField
          label="Apartment, suite, etc."
          autoComplete="address-line2"
          fieldClassName="sm:col-span-2"
          value={data.address.street2}
          maxLength={FIELD_MAX.street}
          onChange={(e) => setAddress({ street2: e.target.value })}
        />
      </FieldGrid>

      <FieldGrid columns={4}>
        <TextField
          label="City"
          required
          autoComplete="address-level2"
          fieldClassName="sm:col-span-2"
          value={data.address.city}
          maxLength={FIELD_MAX.city}
          onChange={(e) => setAddress({ city: e.target.value })}
        />

        <AutocompleteField
          label="State"
          required
          placeholder="Search"
          options={states}
          value={data.address.state}
          onValueChange={pickState}
        />

        <FocusTarget name="postalCode">
          <TextField
            label="ZIP code"
            required
            inputMode="numeric"
            autoComplete="postal-code"
            value={data.address.postalCode}
            error={settled("postalCode", postalCodeProblem(data.address.postalCode))}
            onBlur={touch("postalCode")}
            onChange={(e) => {
              const postalCode = formatPostalCode(e.target.value);

              keepCaret(e, postalCode, DIGIT);
              setAddress({ postalCode });
            }}
          />
        </FocusTarget>
      </FieldGrid>

      <FieldGrid columns={2}>
        <AutocompleteField
          label="Time zone"
          required
          hint={zoneHint}
          placeholder="Search"
          options={timeZones}
          value={data.timeZone}
          onValueChange={(timeZone) => update({ ...data, timeZone })}
        />

        <Field
          label="Service radius"
          labelAction={`${data.serviceRadiusMiles} mi`}
          hint="How far you travel for a job."
        >
          <div className="flex h-10 items-center">
            <Slider
              // The label beside the track cannot reach the control: the `slider` role sits on
              // the input the thumb renders.
              getAriaLabel={() => "Service radius in miles"}
              value={[data.serviceRadiusMiles]}
              onValueChange={(v) =>
                update({ ...data, serviceRadiusMiles: Array.isArray(v) ? v[0] : v })
              }
              min={1}
              max={100}
              step={1}
            />
          </div>
        </Field>
      </FieldGrid>
    </>
  );
}
