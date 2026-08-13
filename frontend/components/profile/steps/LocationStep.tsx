import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldRow } from "../FieldRow";
import { US_STATES, US_TIMEZONES } from "../constants";
import type { StepProps, LocationInfo } from "../types";

// Formats digits into 12345 or 12345-1234 as the user types.
function formatZip(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function LocationStep({ data, update }: StepProps<LocationInfo>) {
  return (
    <div className="space-y-5">
      <FieldRow label="Street address *">
        <Input
          value={data.street}
          onChange={(e) => update({ ...data, street: e.target.value })}
          placeholder="123 Main St"
        />
      </FieldRow>

      <FieldRow label="Address line 2" hint="Optional">
        <Input
          value={data.addressLine2}
          onChange={(e) => update({ ...data, addressLine2: e.target.value })}
          placeholder="Suite 4"
        />
      </FieldRow>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FieldRow label="City *">
          <Input
            value={data.city}
            onChange={(e) => update({ ...data, city: e.target.value })}
            placeholder="Denver"
          />
        </FieldRow>

        <FieldRow label="State *">
          <Select
            value={data.state}
            onValueChange={(v) => update({ ...data, state: v ?? "" })}
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

        <FieldRow label="ZIP *">
          <Input
            value={data.zip}
            onChange={(e) => update({ ...data, zip: formatZip(e.target.value) })}
            placeholder="80202"
            inputMode="numeric"
          />
        </FieldRow>
      </div>

      <FieldRow label="Timezone *" hint="Used for scheduling and booking times">
        <Select
          value={data.timezone}
          onValueChange={(v) => update({ ...data, timezone: v ?? "" })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select your timezone" />
          </SelectTrigger>
          <SelectContent>
            {US_TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label={`Service radius — ${data.radius} mi`}>
        <Slider
          value={[data.radius]}
          onValueChange={(v) => update({ ...data, radius: Array.isArray(v) ? v[0] : v })}
          min={1}
          max={200}
          step={1}
        />
      </FieldRow>
    </div>
  );
}
