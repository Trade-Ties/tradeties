import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, BadgeCheck } from "lucide-react";
import { FieldRow } from "../FieldRow";
import { US_STATES, LICENSE_TYPE_SUGGESTIONS, makeEmptyLicense } from "../constants";
import type { LicenseEntry } from "../types";

interface LicensesStepProps {
  data: LicenseEntry[];
  update: (value: LicenseEntry[]) => void;
  /** State from the business address — used to prefill new license rows. */
  defaultState: string;
}

export function LicensesStep({ data, update, defaultState }: LicensesStepProps) {
  const addLicense = () =>
    update([...data, makeEmptyLicense(Date.now(), defaultState)]);

  const removeLicense = (id: number) => update(data.filter((l) => l.id !== id));

  const editLicense = <K extends keyof LicenseEntry>(
    id: number,
    field: K,
    value: LicenseEntry[K]
  ) =>
    update(
      data.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, [field]: value };
        // "Valid until" can never be before the issue date.
        if (field === "issuedOn" && next.validUntil && next.validUntil < String(value)) {
          next.validUntil = "";
        }
        return next;
      })
    );

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
          <BadgeCheck className="h-8 w-8 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium">No licenses added</p>
            <p className="text-sm text-muted-foreground">
              Optional — add any trade licenses you hold to build trust with clients.
            </p>
          </div>
          <Button variant="outline" onClick={addLicense}>
            <Plus className="h-4 w-4 mr-2" />
            Add license
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Shared suggestion list for every "License type" input below. */}
      <datalist id="license-type-suggestions">
        {LICENSE_TYPE_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {data.map((license, idx) => (
        <div key={license.id} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              License {idx + 1}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => removeLicense(license.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldRow label="State *">
              <Select
                value={license.state}
                onValueChange={(v) => editLicense(license.id, "state", v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label="License number *">
              <Input
                value={license.number}
                onChange={(e) => editLicense(license.id, "number", e.target.value)}
                placeholder="e.g. PL-482910"
              />
            </FieldRow>
          </div>

          <FieldRow label="License type" hint="Pick a suggestion or type your own">
            <Input
              list="license-type-suggestions"
              value={license.type}
              onChange={(e) => editLicense(license.id, "type", e.target.value)}
              placeholder="e.g. Master Plumber"
            />
          </FieldRow>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldRow label="Issued on">
              <Input
                type="date"
                value={license.issuedOn}
                onChange={(e) => editLicense(license.id, "issuedOn", e.target.value)}
              />
            </FieldRow>

            <FieldRow label="Valid until">
              <Input
                type="date"
                value={license.validUntil}
                min={license.issuedOn || undefined}
                onChange={(e) => editLicense(license.id, "validUntil", e.target.value)}
              />
            </FieldRow>
          </div>
        </div>
      ))}

      <Button variant="outline" onClick={addLicense} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add license
      </Button>
    </div>
  );
}
