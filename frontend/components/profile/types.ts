import type { LucideIcon } from "lucide-react";
import type {
  Coordinates,
  MaterialPricingMode,
  ServicePricingMode,
  TravelFeeMode,
} from "@/lib/api/wire";

/**
 * The wizard's form, shaped like the contract it is going to be sent to.
 *
 * The names, the groupings and the enum values are the contract's, not this form's own — every
 * difference would have to be written out twice, once per direction.
 *
 * What is left different is only what a form needs and a wire shape cannot hold. There are four
 * such things, and each says so where it is declared:
 *
 * 1. **Amounts are text.** To type "85.50" you must pass through "85.", which no amount schema
 *    can accept — and should not.
 * 2. **Rows carry a local key.** React needs one before the server has minted an id.
 * 3. **A day carries `open`.** The contract says "closed" with an empty list; the form keeps
 *    the flag so switching a day off and on again returns the hours it had.
 * 4. **`ui`.** The handful of choices that steer the form without ever being sent.
 */

// --- Onboarding steps 1 and 2 — the profile --------------------------------

/** `Address`, with every part held as text — which is what an input can produce. */
export interface AddressForm {
  street1: string;
  street2: string;
  city: string;
  /** Two-letter USPS code, from the catalogue. */
  state: string;
  postalCode: string;
}

/**
 * `CreateBusinessRequest` minus what describes the request rather than the business.
 *
 * `version` and `timeZoneChangeConfirmed` are deliberately absent: the contract keeps them off
 * `BusinessProfile` for the same reason this keeps them off the form — they are statements
 * about one write, not about the business. They are supplied at the boundary.
 */
export interface ProfileForm {
  slug: string;
  legalName: string;
  displayName: string;
  /** Empty means not stated, which the contract spells `null`. */
  description: string;
  /** As typed; a missing `https://` is added on the way out rather than demanded here. */
  websiteUrl: string;
  /** Grouped for reading — "(303) 555-0101" — and sent as E.164. See `phone.ts`. */
  phone: string;
  email: string;
  address: AddressForm;
  /** An IANA zone id from the catalogue. */
  timeZone: string;
  serviceRadiusMiles: number;
}

// --- Onboarding step 3 — trades --------------------------------------------

/** `BusinessTradesRequest`. Ids, because that is what the endpoint takes back. */
export interface TradesForm {
  /** A `Trade.id`, empty until one is chosen. */
  primaryTradeId: string;
  /** `Trade.id`s. Never contains the primary — the contract rejects the repeat. */
  additionalTradeIds: string[];
}

// --- Onboarding step 4 — services ------------------------------------------

/**
 * A row's identity on the server, for the two lists stored one entity per row.
 *
 * Both absent until the row has been written once, which is what tells "create this" apart
 * from "replace that".
 */
export interface ServerRow {
  /** The stored entity's UUID. */
  serverId?: string;
  /** The `version` last read, sent back to catch a concurrent edit. */
  version?: number;
}

/**
 * `ServiceInput`, plus a local key and minus the fields the server owns.
 *
 * `sortOrder` is absent because the contract marks it `readOnly` — the order is changed
 * through its own endpoint, and the form states it by the order of this array. `active` is
 * absent because nothing in the wizard can switch it off yet.
 */
export interface ServiceForm extends ServerRow {
  /**
   * React's key, counted within the form. Never the server's id, and never becomes it: a row
   * needs a key from the moment it is added, which is before anything has been saved.
   */
  key: number;
  /**
   * A `Trade.id`, and one of the trades claimed in step 3 — the contract requires it and the
   * database refuses anything else. Empty only while step 3 is still unanswered, which is a row
   * the step badges and the save holds back rather than a state the resource has.
   */
  tradeId: string;
  name: string;
  description: string;
  estimatedDurationMinutes: number;
  pricingMode: ServicePricingMode;
  /** Text, so a decimal point can be typed. Empty means no price stated. */
  price: string;
}

// --- Onboarding step 5 — rates and terms -----------------------------------

/**
 * `PricingInput`, amounts as text. The cancellation terms are in here rather than beside it
 * because that is where the contract puts them: one resource, written by one call.
 */
export interface PricingForm {
  hourlyRate: string;
  minimumBillableMinutes: number;
  billingIncrementMinutes: number;
  serviceCallFee: string;
  serviceCallFeeWaivedIfHired: boolean;
  travelFeeMode: TravelFeeMode;
  /** Only sent under `FLAT`; kept while another mode is selected, so switching back restores it. */
  travelFlatFee: string;
  /** Only sent under `PER_MILE`, on the same terms. */
  travelRatePerMile: string;
  freeTravelRadiusMiles: string;
  materialPricingMode: MaterialPricingMode;
  /** Only sent under `COST_PLUS_MARKUP`. */
  materialMarkupPercent: string;
  cancellationFee: string;
  cancellationNoticeHours: number;
}

// --- Onboarding step 6 — licences ------------------------------------------

/** `LicenseInput`, plus a local key. Dates as `yyyy-mm-dd`, empty for not stated. */
export interface LicenseForm extends ServerRow {
  key: number;
  state: string;
  licenseNumber: string;
  licenseType: string;
  issuedOn: string;
  expiresOn: string;
}

// --- Onboarding step 7 — the working week ----------------------------------

/**
 * `TimeBlock`, plus a local key.
 *
 * The contract's blocks have no identity — a day is a list of ranges — but React is editing
 * them one at a time and needs to tell two rows apart.
 */
export interface TimeBlockForm {
  key: number;
  startsAt: string;
  endsAt: string;
}

/**
 * `WorkingDay`, plus the one flag the contract has no room for. On the wire a day with no
 * blocks is closed; the form keeps `open` separately so switching a day off and back on returns
 * the hours it had. UI memory, not a second way of storing "closed".
 */
export interface WorkingDayForm {
  /** ISO-8601, the contract's own numbering: 1 is Monday, 7 is Sunday. */
  dayOfWeek: number;
  open: boolean;
  blocks: TimeBlockForm[];
}

/** All seven days, Monday first — the same rule `WorkingHours.days` states. */
export type WorkingHoursForm = WorkingDayForm[];

// --- Onboarding step 8 — booking rules -------------------------------------

/** The three values `slotGranularityMinutes` allows. */
export type SlotGranularity = 15 | 30 | 60;

/** `BookingPolicyInput` minus `version`, which describes the write rather than the rules. */
export interface BookingPolicyForm {
  /**
   * Text, so the box can be empty between clearing it and typing the new figure. Held as a
   * number it cannot: `""` has to become something, that something renders straight back into
   * the field, and the answer you were halfway through replacing is a `0` under your cursor.
   */
  bookingHorizonDays: string;
  minLeadTimeHours: number;
  /** Text, empty for "no cap" — which the contract spells `null`. */
  maxAcceptedAppointmentsPerDay: string;
  slotGranularityMinutes: SlotGranularity;
  appointmentBufferMinutes: number;
}

// --- What steers the form without ever being sent --------------------------

export type CancellationPolicy = "flexible" | "moderate" | "strict" | "custom";

/**
 * The choices that shape the form and have no field behind them, held apart from the shapes
 * above so those stay mirrors of the contract.
 *
 * - `cancellationPolicy` cannot be derived from `cancellationNoticeHours`: "Flexible" means 24
 *   hours, but so can "Custom", and the difference is which control is being steered with.
 * - `cancellationNotes` has no field in the contract at all. It is typed and then dropped —
 *   a gap in the API rather than an oversight in the mapper.
 */
export interface UiState {
  cancellationPolicy: CancellationPolicy;
  cancellationNotes: string;
}

// --- The whole form --------------------------------------------------------

/** One key per API resource, named after it. */
export interface ProfileFormData {
  profile: ProfileForm;
  trades: TradesForm;
  services: ServiceForm[];
  pricing: PricingForm;
  licenses: LicenseForm[];
  workingHours: WorkingHoursForm;
  bookingPolicy: BookingPolicyForm;
  ui: UiState;
}

// --- What the server already holds -----------------------------------------

export interface StoredState {
  /**
   * Where the address geocoded to, as the server last had it — kept so that saving the profile
   * does not throw it away.
   *
   * Not on the form: nobody types it, and there is no control for it. Kept because the profile
   * overview and the map both read it off what was last saved, so the wizard has to have
   * somewhere to hold it between steps.
   *
   * The server does not read what the wizard sends here — it derives the point from the address
   * on every write — so echoing it back changes nothing on that side. It is echoed anyway
   * because the update is a full replacement, and a body that dropped a field the contract
   * carries would be a client quietly disagreeing with the contract.
   */
  coordinates: Coordinates | null;
  /** Null until the profile exists. That is what tells a create from an update. */
  businessVersion: number | null;
  /**
   * The slug the profile is stored under, or null before it has one.
   *
   * Kept so the URL field can tell "taken by someone else" from "taken by you" — the
   * availability endpoint answers about the slug, not about who holds it.
   */
  slug: string | null;
  /**
   * Whether the URL has stopped being the holder's to change, which the first publish decides.
   *
   * Read from the server rather than worked out here. `status` cannot answer it: unpublishing
   * puts a profile that was live for a year back to `DRAFT`, where it looks exactly like one
   * that never published — while the links handed out in that year are still in circulation.
   */
  slugLocked: boolean;
  /** Null until rates have been written once; `PricingInput.version` is omitted then. */
  pricingVersion: number | null;
  /** Always known — `GET` serves defaults at version 0 before the row is provisioned. */
  bookingPolicyVersion: number;
  /**
   * The body each single-resource step was last known to have stored, serialised, or null where
   * nothing has been written for it yet.
   *
   * The counterpart of `StoredList.bodies` for the three steps that are one resource rather
   * than a list of rows. Without them those steps cannot tell an answer from a default and
   * every pass rewrites them — see `UNTOUCHED` in `save.ts`.
   *
   * Serialised without the version, which moves on every write and says nothing about whether
   * the answers did. See `contentOf` in `save.ts`, the only writer of these.
   */
  tradesBody: string | null;
  /**
   * Steps 1 and 2 as they were last stored, for the same reason the four below are recorded.
   *
   * Nothing in the save path needs it — that step is guarded by `profileIsWritable` and by the
   * version, not by a body comparison. It is here so the wizard can answer, without sending
   * anything, whether there is an answer the server has not been told. See
   * `hasUnwrittenAnswers`.
   */
  profileBody: string | null;
  pricingBody: string | null;
  workingHoursBody: string | null;
  bookingPolicyBody: string | null;
  services: StoredList;
  licenses: StoredList;
}

/**
 * What the server holds for one of the two lists stored a row at a time.
 *
 * `ids` answers two questions a form full of rows cannot answer on its own: which stored rows
 * have been deleted — they are the ids no row claims any more — and whether the order has
 * changed, which is its own endpoint rather than a field on each row.
 *
 * `bodies` is what stops a save rewriting rows nobody touched. Each entry is the request body
 * that row was last known to have, serialised; a row whose body still matches is left alone.
 * Without it every "Next" would `PUT` every service, bumping ten versions to store no change.
 */
export interface StoredList {
  /** Server ids, in the order they are stored in. */
  ids: string[];
  /** Server id to its last-known request body, serialised for comparison. */
  bodies: Record<string, string>;
}

// --- The wizard's own furniture --------------------------------------------

/**
 * The steps of the wizard.
 *
 * Deliberately *not* `keyof ProfileFormData`: one step covers several of those keys, because a
 * step is a screen and a key is an API resource.
 */
export type StepKey =
  | "business"
  | "services"
  | "pricing"
  | "availability"
  | "licenses"
  | "publish";

export interface StepDef {
  key: StepKey;
  /** One word, for the step indicator. */
  label: string;
  /** The full heading, shown above the step itself. */
  title: string;
  icon: LucideIcon;
}

export interface StepProps<T> {
  data: T;
  update: (value: T) => void;
}
