import { FieldGrid, SelectField, toOptions } from "@/components/ui/field";
import { CountField } from "../AmountField";
import { BOOKING_HORIZON_MAX, BOOKING_HORIZON_MIN } from "../limits";
import {
  BUFFER_OPTIONS,
  MINIMUM_NOTICE_OPTIONS,
  START_TIME_GRID_OPTIONS,
} from "../options";
import type { BookingPolicyForm, StepProps } from "../types";

const GRID_OPTIONS = toOptions(START_TIME_GRID_OPTIONS, (m) => `${m} minutes`);
const TRAVEL_TIME_OPTIONS = toOptions(BUFFER_OPTIONS, (m) =>
  m === 0 ? "None" : `${m} minutes`
);

export function BookingStep({ data, update }: StepProps<BookingPolicyForm>) {
  return (
    <>
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

        <SelectField
          label="Minimum notice"
          required
          hint="Shortest warning you'll take a job on."
          options={MINIMUM_NOTICE_OPTIONS}
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
        <SelectField
          label="Travel time"
          required
          hint="Held open between two jobs."
          options={TRAVEL_TIME_OPTIONS}
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
    </>
  );
}
