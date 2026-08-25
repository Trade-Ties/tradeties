import type { AutocompleteOption } from "@/components/ui/field";
import type { ReferenceData } from "@/lib/api/reference";

/**
 * **The option value is always what the API takes back** — a `Trade.id`, a USPS state code, an
 * IANA zone id — and the label is only ever what the catalogue says to show for it. A stale
 * label is a wrong word on screen; a stale value is a 400 on save.
 *
 * All three are typed as autocomplete options, whose label is plain text rather than a node:
 * these are the lists long enough to be typed at, and what is typed is matched against the
 * label. The shape is the narrower of the two, so it still passes anywhere a `SelectOption` is
 * asked for, should one of them ever be short enough to go back to a plain select.
 */

interface Derived {
  tradeOptions: AutocompleteOption[];
  stateOptions: AutocompleteOption[];
  timeZoneOptions: AutocompleteOption[];
  trades: Map<string, string>;
  states: Map<string, string>;
  timeZones: Map<string, string>;
}

/**
 * The three catalogues as option lists and as lookups, built once each rather than per call.
 *
 * Keyed on the catalogue itself, which is safe because `ReferenceData` is read on the server and
 * handed down whole, so it is one object for the life of the page. A `WeakMap` so a catalogue
 * that is replaced takes its derivations with it.
 *
 * Worth the machinery for two reasons. `tradeName` is called once per service row per render,
 * outside any memo, while the whole wizard re-renders on every keystroke. And the option lists
 * go straight to `SelectControl` and `AutocompleteControl`, both of which memoise on array
 * identity — rebuilt per call they defeat that memo unless every call site adds its own
 * `useMemo`.
 */
const derivations = new WeakMap<ReferenceData, Derived>();

function derive(reference: ReferenceData): Derived {
  const known = derivations.get(reference);
  if (known !== undefined) return known;

  const built: Derived = {
    tradeOptions: reference.trades.map((trade) => ({ value: trade.id, label: trade.displayName })),
    stateOptions: reference.states.map((state) => ({ value: state.code, label: state.name })),
    timeZoneOptions: reference.timeZones.map((zone) => ({
      value: zone.code,
      label: zone.displayName,
    })),
    trades: new Map(reference.trades.map((trade) => [trade.id, trade.displayName])),
    states: new Map(reference.states.map((state) => [state.code, state.name])),
    timeZones: new Map(reference.timeZones.map((zone) => [zone.code, zone.displayName])),
  };

  derivations.set(reference, built);

  return built;
}

export function tradeOptions(reference: ReferenceData): AutocompleteOption[] {
  return derive(reference).tradeOptions;
}

export function stateOptions(reference: ReferenceData): AutocompleteOption[] {
  return derive(reference).stateOptions;
}

export function timeZoneOptions(reference: ReferenceData): AutocompleteOption[] {
  return derive(reference).timeZoneOptions;
}

/**
 * **Empty for a trade id the catalogue no longer has**, unlike the two below, which fall back
 * to the code they were given. A state code and a zone id still read as something; a trade id
 * is a UUID, which tells a tradesperson strictly less than showing nothing does. Callers read
 * the empty string as "say nothing here", and the publish review as an open question.
 */
export function tradeName(reference: ReferenceData, tradeId: string): string {
  return derive(reference).trades.get(tradeId) ?? "";
}

export function stateName(reference: ReferenceData, code: string): string {
  return derive(reference).states.get(code) ?? code;
}

export function timeZoneName(reference: ReferenceData, code: string): string {
  return derive(reference).timeZones.get(code) ?? code;
}
