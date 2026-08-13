import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldRow } from "../FieldRow";
import {
  MINIMUM_NOTICE_OPTIONS,
  START_TIME_GRID_OPTIONS,
  BUFFER_OPTIONS,
} from "../constants";
import type { StepProps, BookingPrefs } from "../types";

export function BookingStep({ data, update }: StepProps<BookingPrefs>) {
  return (
    <div className="space-y-5">
      <FieldRow label="Bookable up to *" hint="How far ahead clients can book">
        <div className="relative w-56">
          <Input
            value={String(data.bookableAheadDays)}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "");
              const n = digits === "" ? 0 : Math.min(730, Number(digits));
              update({ ...data, bookableAheadDays: n });
            }}
            onBlur={() => {
              // Clamp into the valid 1–730 range once they're done typing.
              if (data.bookableAheadDays < 1) update({ ...data, bookableAheadDays: 1 });
            }}
            inputMode="numeric"
            className="pr-28"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            days in advance
          </span>
        </div>
      </FieldRow>

      <FieldRow label="Minimum notice *" hint="Shortest warning you'll accept before a job">
        <Select
          value={String(data.minimumNoticeHours)}
          onValueChange={(v) => update({ ...data, minimumNoticeHours: Number(v ?? 24) })}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MINIMUM_NOTICE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Appointments per day">
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <Switch
              checked={data.unlimitedPerDay}
              onCheckedChange={(v) =>
                update({ ...data, unlimitedPerDay: v, maxPerDay: v ? "" : data.maxPerDay })
              }
            />
            Unlimited
          </label>

          {!data.unlimitedPerDay && (
            <Input
              value={data.maxPerDay}
              onChange={(e) =>
                update({ ...data, maxPerDay: e.target.value.replace(/[^\d]/g, "") })
              }
              placeholder="e.g. 4"
              inputMode="numeric"
              className="w-32"
            />
          )}
        </div>
      </FieldRow>

      <FieldRow
        label="Start time grid *"
        hint="Appointments can only start on these intervals"
      >
        <div className="grid grid-cols-3 gap-1 rounded-lg border p-1 max-w-sm">
          {START_TIME_GRID_OPTIONS.map((m) => {
            const active = data.startTimeGridMinutes === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => update({ ...data, startTimeGridMinutes: m })}
                className={[
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                ].join(" ")}
              >
                {m} min
              </button>
            );
          })}
        </div>
      </FieldRow>

      <FieldRow label="Travel time *" hint="Buffer held open between appointments">
        <Select
          value={String(data.bufferMinutes)}
          onValueChange={(v) => update({ ...data, bufferMinutes: Number(v ?? 0) })}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUFFER_OPTIONS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m === 0 ? "None" : `${m} minutes`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>
    </div>
  );
}
