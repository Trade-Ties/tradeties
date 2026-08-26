/**
 * What the contract allows, mirrored from `openapi.yaml`: the caps and bounds the form applies
 * before a value can be sent.
 */

/**
 * The `maxLength` for every text box on the wizard.
 *
 * A text field added without a cap here fails in the one way the form cannot explain: the
 * over-long value goes over and comes back as `"Invalid request content."` about the whole step,
 * naming neither the field nor the length.
 */
export const FIELD_MAX = {
  legalName: 200,
  displayName: 200,
  description: 2000,
  street: 200,
  city: 100,
  serviceName: 160,
  serviceDescription: 2000,
  licenseNumber: 64,
  licenseType: 120,
} as const;

/**
 * The `maxLength` for the two amount types, which are their column widths: `MoneyAmount` is
 * `NUMERIC(19,4)` and `PercentAmount` is `NUMERIC(5,2)`.
 */
export const MONEY_MAX = 20;
export const PERCENT_MAX = 6;

/**
 * The bounds of `BookingPolicyInput.bookingHorizonDays`, in one place rather than at the three
 * that apply them — the field's hint, its ceiling, the mapper's clamp. A mapper clamping to a
 * figure the contract has since moved rewrites the value silently, and the save still succeeds.
 */
export const BOOKING_HORIZON_MIN = 1;
export const BOOKING_HORIZON_MAX = 730;
