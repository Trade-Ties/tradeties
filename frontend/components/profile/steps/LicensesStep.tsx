import { useMemo, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Plus, Trash2 } from "lucide-react";
import {
  AutocompleteField,
  Field,
  FieldGrid,
  SuggestField,
  TextField,
} from "@/components/ui/field";
import { CollapsibleRow, EmptyList } from "../CollapsibleRow";
import type { ReferenceData } from "@/lib/api/reference";
import {
  FIELD_MAX,
  LICENSE_TYPE_SUGGESTIONS,
  licenseHeading,
  makeEmptyLicense,
} from "../constants";
import { stateOptions } from "../reference";
import { useRowList } from "../rowList";
import type { LicenseForm } from "../types";
import {
  duplicateLicenseKeys,
  licenseDatesAreBackwards,
  licenseKey,
  licenseProblem,
} from "../validate";

interface LicensesStepProps {
  data: LicenseForm[];
  update: (value: LicenseForm[]) => void;
  reference: ReferenceData;
  /** State from the business address — used to prefill new license rows. */
  defaultState: string;
}

/**
 * "2027-03-14" -> "03/14/2027", the US way round.
 *
 * Written out rather than left to `toLocaleDateString`, which answers in the server's locale
 * during the first render and in the browser's afterwards.
 */
function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** The store side of `useSyncExternalStore`: the day never changes under an open wizard. */
const subscribeToNothing = () => () => {};

/** Empty for a license that carries no dates at all: there is nothing to say about it. */
function validityLabel(license: LicenseForm): string {
  if (license.expiresOn !== "") return `Valid until ${formatDate(license.expiresOn)}`;
  if (license.issuedOn !== "") return `Issued ${formatDate(license.issuedOn)}`;
  return "";
}

export function LicensesStep({ data, update, reference, defaultState }: LicensesStepProps) {
  // Rebuilt only when the catalogue is — every row's state field renders from this one array.
  const states = stateOptions(reference);
  /**
   * Today, as `yyyy-mm-dd`, for calling a license expired.
   *
   * Not read during the first render: the server's clock sits in a different zone, and a date a
   * day off the browser's is a hydration mismatch. The server is handed `""` — nothing is
   * called expired — and the real day arrives with the browser.
   */
  const today = useSyncExternalStore(subscribeToNothing, todayISO, () => "");

  /**
   * No edit here corrects another field. A date input emits every intermediate year as it is
   * keyed, so clearing the expiry when an issue date passes it would lose the answer on the way
   * to typing 2018. The pair is badged instead, and the row held back by `licenseIsWritable`.
   */
  const rows = useRowList(data, update);

  const duplicates = useMemo(() => duplicateLicenseKeys(data), [data]);

  return (
    <Field
      label="Licenses"
      hint="Trade licenses you hold. Clients see these on your profile."
      labelAction={data.length > 0 ? `${data.length} listed` : undefined}
    >
      <div className="space-y-2 pt-1">
        {data.length === 0 && (
          <EmptyList>
            No licenses yet. A listed license is what tells a client you are allowed to do the
            work.
          </EmptyList>
        )}

        {data.map((license, idx) => {
          const isOpen = rows.openId === license.key;
          const number = license.licenseNumber.trim();

          // The row badge names the first thing wrong; the three below are the same answers
          // said again where the field that owns each one is.
          const problem = licenseProblem(license, duplicates, today);
          const isDuplicate = duplicates.has(licenseKey(license) ?? "");
          const datesBackwards = licenseDatesAreBackwards(license);
          const isExpired = today !== "" && license.expiresOn !== "" && license.expiresOn < today;

          const heading = licenseHeading(reference, license);
          const validity = validityLabel(license);

          return (
            <CollapsibleRow
              key={license.key}
              panelId={`license-${license.key}`}
              open={isOpen}
              onToggle={() => rows.toggle(license.key)}
              title={heading === "" ? "Untitled license" : heading}
              titleMuted={heading === ""}
              problem={problem}
              summary={
                <>
                  {license.state !== "" && <span>{license.state}</span>}
                  {number !== "" && <span className="tabular-nums">{number}</span>}
                  {validity !== "" && <span>{validity}</span>}
                </>
              }
              actions={
                <IconButton
                  label={`Remove ${heading === "" ? `license ${idx + 1}` : heading}`}
                  onClick={() => rows.remove(license.key)}
                >
                  <Trash2 className="size-4" />
                </IconButton>
              }
              panelClassName="space-y-4 p-4"
            >
              <FieldGrid columns={3}>
                <SuggestField
                  label="License type"
                  suggestions={LICENSE_TYPE_SUGGESTIONS}
                  autoFocus={rows.focusId === license.key}
                  fieldClassName="sm:col-span-2"
                  hint="Pick a suggestion or type your own."
                  placeholder="e.g. Master Plumber"
                  maxLength={FIELD_MAX.licenseType}
                  value={license.licenseType}
                  onValueChange={(type) => rows.edit(license.key, "licenseType", type)}
                />

                <AutocompleteField
                  label="Issuing state"
                  required
                  placeholder="Search"
                  options={states}
                  value={license.state}
                  onValueChange={(state) => rows.edit(license.key, "state", state)}
                />
              </FieldGrid>

              <FieldGrid columns={3}>
                <TextField
                  label="License number"
                  required
                  placeholder="e.g. PL-482910"
                  maxLength={FIELD_MAX.licenseNumber}
                  value={license.licenseNumber}
                  error={
                    isDuplicate ? "You already have this number for this state." : undefined
                  }
                  onChange={(e) => rows.edit(license.key, "licenseNumber", e.target.value)}
                />

                {/* `lang` rather than the browser's own locale: this is a US product, and
                    the picker is to read mm/dd/yyyy wherever it is opened. */}
                <TextField
                  label="Issued on"
                  type="date"
                  lang="en-US"
                  value={license.issuedOn}
                  onChange={(e) => rows.edit(license.key, "issuedOn", e.target.value)}
                />

                {/* `min` rather than a complaint after the fact: the picker can refuse an
                    impossible day while it is open, and no renewal is backdated. */}
                <TextField
                  label="Valid until"
                  type="date"
                  lang="en-US"
                  min={license.issuedOn || undefined}
                  value={license.expiresOn}
                  error={
                    datesBackwards
                      ? "This is before the issue date."
                      : isExpired
                        ? "This license has expired."
                        : undefined
                  }
                  onChange={(e) => rows.edit(license.key, "expiresOn", e.target.value)}
                />
              </FieldGrid>
            </CollapsibleRow>
          );
        })}

        <Button variant="outline" onClick={() => rows.add((key) => makeEmptyLicense(key, defaultState))} className="w-full">
          <Plus className="mr-2 size-4" />
          Add license
        </Button>
      </div>
    </Field>
  );
}
