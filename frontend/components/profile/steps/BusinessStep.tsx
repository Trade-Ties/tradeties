import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldRow } from "../FieldRow";
import type { StepProps, BusinessInfo } from "../types";

const DESCRIPTION_MAX = 2000;
const LEGAL_NAME_MAX = 200;

// Formats raw digits into a US-style (303) 555-0101 phone number as the user types.
function formatUsPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  const len = digits.length;
  if (len === 0) return "";
  if (len < 4) return `(${digits}`;
  if (len < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function BusinessStep({ data, update }: StepProps<BusinessInfo>) {
  return (
    <div className="space-y-4">
      <FieldRow label="Legal business name *" hint="e.g. Joe's Plumbing LLC">
        <Input
          value={data.legalName}
          maxLength={LEGAL_NAME_MAX}
          onChange={(e) => update({ ...data, legalName: e.target.value })}
          placeholder="Your registered business name"
        />
      </FieldRow>

      <FieldRow label="Description">
        <Textarea
          value={data.description}
          maxLength={DESCRIPTION_MAX}
          onChange={(e) => update({ ...data, description: e.target.value })}
          placeholder="A short intro clients will see first"
          rows={4}
        />
        <p className="text-xs text-muted-foreground text-right">
          {data.description.length}/{DESCRIPTION_MAX}
        </p>
      </FieldRow>

      <FieldRow label="Website" hint="Optional">
        <Input
          type="url"
          value={data.website}
          onChange={(e) => update({ ...data, website: e.target.value })}
          placeholder="https://yourbusiness.com"
        />
      </FieldRow>

      <FieldRow label="Phone number *">
        <Input
          type="tel"
          value={data.phone}
          onChange={(e) => update({ ...data, phone: formatUsPhone(e.target.value) })}
          placeholder="(303) 555-0101"
        />
      </FieldRow>

      <FieldRow
        label="Business email *"
        hint="Can be different from your login email — this address is shown publicly."
      >
        <Input
          type="email"
          value={data.email}
          onChange={(e) => update({ ...data, email: e.target.value })}
          placeholder="contact@yourbusiness.com"
        />
      </FieldRow>
    </div>
  );
}
