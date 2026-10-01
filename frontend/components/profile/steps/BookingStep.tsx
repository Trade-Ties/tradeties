import { FieldGrid, SelectField, toOptions } from "@/components/ui/field";
import { CountField } from "../AmountField";
import { BOOKING_HORIZON_MAX, BOOKING_HORIZON_MIN, NOTICE_HOURS_MAX, TRAVEL_MINUTES_MAX } from "../limits";
import {
  BUFFER_OPTIONS,
  MINIMUM_NOTICE_PRESETS,
  noticeLabel,
  START_TIME_GRID_OPTIONS,
  travelTimeLabel,
} from "../options";
import { PresetOrCustomField } from "../PresetOrCustomField";
import type { BookingPolicyForm, StepProps } from "../types";
import { FocusTarget } from "../focusTarget";

const GRID_OPTIONS = toOptions(START_TIME_GRID_OPTIONS, (m) => `${m} minutes`);

export function BookingStep({ data, update }: StepProps<BookingPolicyForm>) {
  return (
    <FocusTarget name="bookingPolicy" section>
      <FieldGrid columns={3}>
        <CountField
          label="Bookable up to"
          required
          suffix="days"
          hint={`How far ahead the calendar is open. ${BOOKING_HORIZON_MAX} at most.`}
          value={data.bookingHorizonDays}
          // The ceiling is safe to apply per keystroke — it can only ever shorten what is
          // already there. The floor is not, which is why an empty box stays empty here.
          onValueChange={(digits) =>
            update({
              ...data,
              bookingHorizonDays:
                digits === "" ? "" : String(Math.min(BOOKING_HORIZON_MAX, Number(digits))),
            })
          }
          // Clamped on the way out rather than on each keystroke: a floor applied while typing
          // turns the empty box you just cleared back into a 1 under the cursor.
          onBlur={() => {
            const days = Number(data.bookingHorizonDays);
            if (data.bookingHorizonDays === "" || days < BOOKING_HORIZON_MIN) {
              update({ ...data, bookingHorizonDays: String(BOOKING_HORIZON_MIN) });
            }
          }}
        />

        <PresetOrCustomField
          label="Minimum notice"
          hint="Shortest warning you'll take a job on."
          unit="hours"
          max={NOTICE_HOURS_MAX}
          presets={MINIMUM_NOTICE_PRESETS}
          format={noticeLabel}
          value={data.minLeadTimeHours}
          onValueChange={(minLeadTimeHours) => update({ ...data, minLeadTimeHours })}
        />

        <SelectField
          label="Start times every"
          required
          hint="The minutes a job may start on."
          options={GRID_OPTIONS}
          value={data.slotGranularityMinutes}
          onValueChange={(slotGranularityMinutes) =>
            update({ ...data, slotGranularityMinutes })
          }
        />
      </FieldGrid>

      <FieldGrid columns={3}>
        <PresetOrCustomField
          label="Travel time"
          hint="Held open between two jobs."
          unit="minutes"
          max={TRAVEL_MINUTES_MAX}
          presets={BUFFER_OPTIONS}
          format={travelTimeLabel}
          value={data.appointmentBufferMinutes}
          onValueChange={(appointmentBufferMinutes) =>
            update({ ...data, appointmentBufferMinutes })
          }
        />

        {/* Empty is the answer for "no cap" — the contract's own "unlimited" flag is computed
            from this on the way to the wire rather than stored beside it, so the two cannot
            come to disagree. */}
        <CountField
          label="Appointments per day"
          placeholder="No limit"
          hint="Leave empty to take as many as fit."
          value={data.maxAcceptedAppointmentsPerDay}
          onValueChange={(maxAcceptedAppointmentsPerDay) =>
            update({ ...data, maxAcceptedAppointmentsPerDay })
          }
        />
      </FieldGrid>
    </FocusTarget>
  );
}
