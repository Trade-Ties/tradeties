import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, CopyCheck } from "lucide-react";
import { DAYS, TIME_OPTIONS, formatTime, makeTimeBlock } from "../constants";
import type { StepProps, WorkingHours, TimeBlock } from "../types";

/** "13:30" -> 810 minutes, for comparing times. */
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Returns the ids of blocks that overlap another block on the same day. */
function findOverlaps(blocks: TimeBlock[]): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      if (toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end)) {
        bad.add(a.id);
        bad.add(b.id);
      }
    }
  }
  return bad;
}

export function HoursStep({ data, update }: StepProps<WorkingHours>) {
  const setDay = (day: string, next: Partial<WorkingHours[string]>) =>
    update({ ...data, [day]: { ...data[day], ...next } });

  const editBlock = (day: string, blockId: number, field: "start" | "end", value: string) => {
    const blocks = data[day].blocks.map((b) => {
      if (b.id !== blockId) return b;
      const next = { ...b, [field]: value };
      // Keep end after start.
      if (toMinutes(next.end) <= toMinutes(next.start)) {
        if (field === "start") {
          const idx = TIME_OPTIONS.indexOf(value);
          next.end = TIME_OPTIONS[Math.min(idx + 4, TIME_OPTIONS.length - 1)];
        } else {
          return b; // reject an end that isn't after the start
        }
      }
      return next;
    });
    setDay(day, { blocks });
  };

  const addBlock = (day: string) => {
    const blocks = data[day].blocks;
    const last = blocks[blocks.length - 1];
    // Start the new block an hour after the previous one ends, if there's room.
    const startIdx = last ? Math.min(TIME_OPTIONS.indexOf(last.end) + 4, 92) : 32;
    setDay(day, {
      blocks: [
        ...blocks,
        makeTimeBlock(Date.now(), TIME_OPTIONS[startIdx], TIME_OPTIONS[startIdx + 4]),
      ],
    });
  };

  const removeBlock = (day: string, blockId: number) =>
    setDay(day, { blocks: data[day].blocks.filter((b) => b.id !== blockId) });

  /** Copies Monday's setup (or the first open day's) onto every other day. */
  const copyToAllDays = () => {
    const source = DAYS.find((d) => data[d].open) ?? DAYS[0];
    const template = data[source];
    const next: WorkingHours = {};
    DAYS.forEach((day, i) => {
      next[day] = {
        open: template.open,
        blocks: template.blocks.map((b, j) => ({
          ...b,
          id: Number(`${i + 1}${j + 1}${Date.now() % 10000}`),
        })),
      };
    });
    update(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={copyToAllDays}>
          <CopyCheck className="h-4 w-4 mr-2" />
          Apply to all days
        </Button>
      </div>

      {DAYS.map((day) => {
        const dayData = data[day];
        const overlaps = findOverlaps(dayData.blocks);

        return (
          <div key={day} className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center gap-3">
              <Switch
                checked={dayData.open}
                onCheckedChange={(v) =>
                  setDay(day, {
                    open: v,
                    // Give the day a block to work with if it has none.
                    blocks: dayData.blocks.length ? dayData.blocks : [makeTimeBlock(Date.now())],
                  })
                }
              />
              <span className="text-sm font-medium">{day}</span>
              {!dayData.open && (
                <span className="ml-auto text-sm text-muted-foreground">Closed</span>
              )}
            </div>

            {dayData.open && (
              <div className="space-y-2 pl-1">
                {dayData.blocks.map((block) => {
                  const isOverlapping = overlaps.has(block.id);
                  return (
                    <div key={block.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Select
                          value={block.start}
                          onValueChange={(v) => editBlock(day, block.id, "start", v ?? block.start)}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            {TIME_OPTIONS.slice(0, 96).map((t) => (
                              <SelectItem key={t} value={t}>
                                {formatTime(t)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <span className="text-muted-foreground text-sm">to</span>

                        <Select
                          value={block.end}
                          onValueChange={(v) => editBlock(day, block.id, "end", v ?? block.end)}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            {TIME_OPTIONS.filter(
                              (t) => toMinutes(t) > toMinutes(block.start)
                            ).map((t) => (
                              <SelectItem key={t} value={t}>
                                {formatTime(t)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {dayData.blocks.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => removeBlock(day, block.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {isOverlapping && (
                        <p className="text-sm text-destructive">
                          This block overlaps another one on {day}.
                        </p>
                      )}
                    </div>
                  );
                })}

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => addBlock(day)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Block
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
