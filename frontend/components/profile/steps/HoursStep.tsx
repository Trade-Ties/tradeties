import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Switch } from "@/components/ui/switch";
import { Copy, Plus, Trash2 } from "lucide-react";
import { CheckboxField, CheckboxGrid, Field, SelectControl, toOptions } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  TIME_OPTIONS,
  dayName,
  formatHours,
  formatTime,
  makeTimeBlock,
  nextKey,
  toMinutes,
  weeklyMinutes,
} from "../constants";
import type { StepProps, WorkingDayForm, WorkingHoursForm } from "../types";
import { overlappingBlockKeys } from "../validate";

/** Quarter-hour slots in an hour, which is the block length and the gap a new one is offered at. */
const AN_HOUR = 4;

/** The last index of `TIME_OPTIONS`, which is "24:00" and only ever an end. */
const LAST_SLOT = TIME_OPTIONS.length - 1;

/** 08:00, where the first block of an otherwise empty day starts. */
const DAY_STARTS_AT = 32;

/**
 * Week-wide rather than per day: copying a day's ranges onto another carries their keys with
 * them, and two blocks on one day must never share one.
 */
function nextBlockKey(week: WorkingHoursForm): number {
  return nextKey(week.flatMap((day) => day.blocks));
}

/** `24:00` is an end value only, so the start list stops one short of the end list. */
const END_TIME_OPTIONS = toOptions(TIME_OPTIONS, formatTime);
const START_TIME_OPTIONS = END_TIME_OPTIONS.slice(0, LAST_SLOT);

/**
 * The first slot at or after a given time, or -1 when there is none.
 *
 * By minutes rather than by `indexOf`: the contract's `TimeOfDay` allows any minute, so a
 * stored "17:05" is not on this quarter-hour grid at all and `indexOf` would answer -1 for a
 * time that does have a slot after it. Callers must still handle the -1.
 */
const slotAtOrAfter = (time: string) =>
  TIME_OPTIONS.findIndex((slot) => toMinutes(slot) >= toMinutes(time));

/**
 * The end times that can follow a given start time.
 *
 * `TIME_OPTIONS` is sorted, so "after this start" is a suffix of the list. Cached rather than
 * sliced per render, because `SelectControl` memoises its items on the array identity. One
 * entry per distinct start time asked for, so it cannot grow beyond the form.
 */
const endOptions = new Map<string, typeof END_TIME_OPTIONS>();

function endOptionsAfter(startsAt: string): typeof END_TIME_OPTIONS {
  const known = endOptions.get(startsAt);
  if (known !== undefined) return known;

  const first = TIME_OPTIONS.findIndex((slot) => toMinutes(slot) > toMinutes(startsAt));
  const options = first < 0 ? [] : END_TIME_OPTIONS.slice(first);
  endOptions.set(startsAt, options);

  return options;
}

/**
 * Held as the contract holds it — seven entries, Monday first, each carrying its ISO
 * `dayOfWeek` — so the order the wire wants is the order the form already has. The day *name*
 * is only ever a label, looked up when one is drawn.
 */
export function HoursStep({ data, update }: StepProps<WorkingHoursForm>) {
  /** The day whose copy panel is open, by `dayOfWeek`. */
  const [copyFrom, setCopyFrom] = useState<number | null>(null);
  const [copyTargets, setCopyTargets] = useState<number[]>([]);

  const setDay = (dayOfWeek: number, next: Partial<WorkingDayForm>) =>
    update(data.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...next } : day)));

  const dayAt = (dayOfWeek: number) =>
    data.find((day) => day.dayOfWeek === dayOfWeek) ?? data[0];

  const editBlock = (
    dayOfWeek: number,
    blockKey: number,
    field: "startsAt" | "endsAt",
    value: string
  ) => {
    const blocks = dayAt(dayOfWeek).blocks.map((b) => {
      if (b.key !== blockKey) return b;
      const next = { ...b, [field]: value };
      if (toMinutes(next.endsAt) <= toMinutes(next.startsAt)) {
        if (field === "startsAt") {
          // An hour later, or the end of the day if there is not an hour left in it.
          const idx = slotAtOrAfter(value);
          next.endsAt =
            idx < 0 ? TIME_OPTIONS[LAST_SLOT] : TIME_OPTIONS[Math.min(idx + AN_HOUR, LAST_SLOT)];
        } else {
          return b; // reject an end that isn't after the start
        }
      }
      return next;
    });
    setDay(dayOfWeek, { blocks });
  };

  const addBlock = (dayOfWeek: number) => {
    const blocks = dayAt(dayOfWeek).blocks;
    const last = blocks[blocks.length - 1];

    // The first slot at or after the day's current end; -1 when the day has no room left.
    const earliest = last ? slotAtOrAfter(last.endsAt) : DAY_STARTS_AT;

    // A block needs a whole hour's room before midnight. Clamping instead would hand back a
    // block starting before the previous one ended, and the contract refuses overlaps — which
    // takes the whole day's write with them.
    if (earliest < 0 || earliest > LAST_SLOT - AN_HOUR) return;

    // An hour's gap after the previous block, or none at all for the first one of the day.
    const startIdx = Math.min(earliest + (last ? AN_HOUR : 0), LAST_SLOT - AN_HOUR);

    setDay(dayOfWeek, {
      blocks: [
        ...blocks,
        makeTimeBlock(
          nextBlockKey(data),
          TIME_OPTIONS[startIdx],
          TIME_OPTIONS[startIdx + AN_HOUR]
        ),
      ],
    });
  };

  const removeBlock = (dayOfWeek: number, blockKey: number) =>
    setDay(dayOfWeek, {
      blocks: dayAt(dayOfWeek).blocks.filter((b) => b.key !== blockKey),
    });

  const toggleDay = (dayOfWeek: number, open: boolean) => {
    // Give the day a block to work with if it has none, and take the copy panel down with it:
    // a closed day has no hours to hand anyone.
    const blocks = dayAt(dayOfWeek).blocks;
    setDay(dayOfWeek, {
      open,
      blocks: blocks.length ? blocks : [makeTimeBlock(nextBlockKey(data))],
    });
    if (!open && copyFrom === dayOfWeek) setCopyFrom(null);
  };

  /**
   * Opens the copy panel with the other days that are already open ticked — the days
   * deliberately left closed stay closed unless they are ticked on purpose.
   */
  const openCopy = (dayOfWeek: number) => {
    setCopyFrom(dayOfWeek);
    setCopyTargets(
      data.filter((d) => d.dayOfWeek !== dayOfWeek && d.open).map((d) => d.dayOfWeek)
    );
  };

  const toggleTarget = (dayOfWeek: number) =>
    setCopyTargets((prev) =>
      prev.includes(dayOfWeek) ? prev.filter((d) => d !== dayOfWeek) : [...prev, dayOfWeek]
    );

  const applyCopy = () => {
    if (copyFrom === null) return;
    const template = dayAt(copyFrom);
    let key = nextBlockKey(data);

    update(
      data.map((day) =>
        copyTargets.includes(day.dayOfWeek)
          ? {
              ...day,
              open: true,
              blocks: template.blocks.map((b) => ({ ...b, key: key++ })),
            }
          : day
      )
    );
    setCopyFrom(null);
  };

  const weekTotal = weeklyMinutes(data);

  return (
    <Field
      label="Working hours"
      required
      hint="When you take jobs. Clients only see slots inside these hours."
      labelAction={`${formatHours(weekTotal)} a week`}
    >
      <div className="divide-y rounded-lg border">
        {data.map((dayData) => {
          const day = dayName(dayData.dayOfWeek);
          const overlaps = overlappingBlockKeys(dayData.blocks);
          const isCopying = copyFrom === dayData.dayOfWeek;

          return (
            <div
              key={dayData.dayOfWeek}
              className="grid items-start gap-x-3 gap-y-2 px-3 py-2 sm:grid-cols-[9.5rem_1fr_auto]"
            >
              <label className="flex h-10 cursor-pointer items-center gap-3 text-sm">
                <Switch
                  checked={dayData.open}
                  onCheckedChange={(v) => toggleDay(dayData.dayOfWeek, v === true)}
                />
                <span className={cn("font-medium", !dayData.open && "text-muted-foreground")}>
                  {day}
                </span>
              </label>

              {dayData.open ? (
                <div className="space-y-2">
                  {dayData.blocks.map((block) => {
                    const isOverlapping = overlaps.has(block.key);

                    return (
                      <div key={block.key}>
                        <div className="flex h-10 items-center gap-2">
                          <SelectControl
                            aria-label={`${day} start time`}
                            aria-invalid={isOverlapping || undefined}
                            className="w-[7.5rem]"
                            contentClassName="max-h-64"
                            options={START_TIME_OPTIONS}
                            value={block.startsAt}
                            onValueChange={(startsAt) =>
                              editBlock(dayData.dayOfWeek, block.key, "startsAt", startsAt)
                            }
                          />

                          <span aria-hidden="true" className="text-sm text-muted-foreground">
                            –
                          </span>

                          <SelectControl
                            aria-label={`${day} end time`}
                            aria-invalid={isOverlapping || undefined}
                            className="w-[7.5rem]"
                            contentClassName="max-h-64"
                            options={endOptionsAfter(block.startsAt)}
                            value={block.endsAt}
                            onValueChange={(endsAt) =>
                              editBlock(dayData.dayOfWeek, block.key, "endsAt", endsAt)
                            }
                          />

                          {/* The first range is what makes the day open — the switch removes
                              it, so there is nothing for a bin to do beside it. */}
                          {dayData.blocks.length > 1 && (
                            <IconButton
                              label={`Remove this time range from ${day}`}
                              onClick={() => removeBlock(dayData.dayOfWeek, block.key)}
                            >
                              <Trash2 className="size-4" />
                            </IconButton>
                          )}
                        </div>

                        {isOverlapping && (
                          <p className="text-xs text-destructive">
                            This range overlaps another one on {day}.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="flex h-10 items-center text-sm text-muted-foreground">
                  Closed
                </span>
              )}

              {dayData.open && (
                <div className="flex h-10 items-center gap-1">
                  <IconButton
                    label={`Add another time range to ${day}`}
                    onClick={() => addBlock(dayData.dayOfWeek)}
                  >
                    <Plus className="size-4" />
                  </IconButton>
                  <IconButton
                    label={`Copy ${day}'s hours to other days`}
                    aria-expanded={isCopying}
                    onClick={() => (isCopying ? setCopyFrom(null) : openCopy(dayData.dayOfWeek))}
                  >
                    <Copy className="size-4" />
                  </IconButton>
                </div>
              )}

              {isCopying && (
                <div className="col-span-full space-y-3 rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Copy {day}&rsquo;s hours to
                  </p>

                  <CheckboxGrid>
                    {data
                      .filter((d) => d.dayOfWeek !== dayData.dayOfWeek)
                      .map((d) => (
                        <CheckboxField
                          key={d.dayOfWeek}
                          label={dayName(d.dayOfWeek)}
                          checked={copyTargets.includes(d.dayOfWeek)}
                          onCheckedChange={() => toggleTarget(d.dayOfWeek)}
                        />
                      ))}
                  </CheckboxGrid>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={applyCopy} disabled={copyTargets.length === 0}>
                      Apply
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCopyFrom(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Field>
  );
}
