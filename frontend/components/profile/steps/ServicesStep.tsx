import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { FieldRow } from "../FieldRow";
import {
  DURATION_OPTIONS,
  PRICE_MODELS,
  SERVICE_NAME_MAX,
  CROSS_TRADE,
  makeEmptyService,
} from "../constants";
import type { ServiceItem, PriceModel } from "../types";

interface ServicesStepProps {
  data: ServiceItem[];
  update: (value: ServiceItem[]) => void;
  /** Trades chosen back in step 3 — these populate each service's trade dropdown. */
  availableTrades: string[];
}

export function ServicesStep({ data, update, availableTrades }: ServicesStepProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const addService = () => update([...data, makeEmptyService(Date.now())]);
  const removeService = (id: number) => update(data.filter((s) => s.id !== id));

  const editService = <K extends keyof ServiceItem>(
    id: number,
    field: K,
    value: ServiceItem[K]
  ) => update(data.map((s) => (s.id === id ? { ...s, [field]: value } : s)));

  // Name must be unique within the business.
  const duplicateNames = new Set(
    data
      .map((s) => s.name.trim().toLowerCase())
      .filter((n, i, arr) => n !== "" && arr.indexOf(n) !== i)
  );

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...data];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    update(next);
    setDragIndex(null);
  };

  return (
    <div className="space-y-4">
      {data.map((service, idx) => {
        const isDuplicate =
          service.name.trim() !== "" &&
          duplicateNames.has(service.name.trim().toLowerCase());
        const showPrice = service.priceModel !== "quote";
        const priceOptional = service.priceModel === "hourly";

        return (
          <div
            key={service.id}
            draggable
            onDragStart={() => setDragIndex(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            onDragEnd={() => setDragIndex(null)}
            className={[
              "rounded-lg border p-4 space-y-3 bg-background transition-opacity",
              dragIndex === idx ? "opacity-50" : "",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                <span className="text-sm font-medium text-muted-foreground">
                  Service {idx + 1}
                </span>
              </div>
              {data.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => removeService(service.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <FieldRow label="Name *">
              <Input
                value={service.name}
                maxLength={SERVICE_NAME_MAX}
                onChange={(e) => editService(service.id, "name", e.target.value)}
                placeholder="e.g. Clog removal"
              />
              {isDuplicate && (
                <p className="text-sm text-destructive">
                  You already have a service with this name.
                </p>
              )}
            </FieldRow>

            <FieldRow label="Description">
              <Textarea
                value={service.description}
                onChange={(e) => editService(service.id, "description", e.target.value)}
                placeholder="What's included in this service?"
                rows={3}
              />
            </FieldRow>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldRow label="Trade">
                <Select
                  value={service.trade}
                  onValueChange={(v) => editService(service.id, "trade", v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTrades.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                    <SelectItem value={CROSS_TRADE}>Cross-trade</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow
                label="Calendar duration *"
                hint="Time reserved in your calendar, not what you bill"
              >
                <Select
                  value={String(service.durationMinutes)}
                  onValueChange={(v) =>
                    editService(service.id, "durationMinutes", Number(v ?? 60))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
            </div>

            <FieldRow label="Price model *">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-lg border p-1">
                {PRICE_MODELS.map((m) => {
                  const active = service.priceModel === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() =>
                        editService(service.id, "priceModel", m.value as PriceModel)
                      }
                      className={[
                        "rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted",
                      ].join(" ")}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </FieldRow>

            {showPrice && (
              <FieldRow
                label={priceOptional ? "Different hourly rate" : "Price *"}
                hint={
                  priceOptional
                    ? "Leave empty to use your standard hourly rate"
                    : undefined
                }
              >
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    $
                  </span>
                  <Input
                    value={service.price}
                    onChange={(e) =>
                      editService(
                        service.id,
                        "price",
                        e.target.value.replace(/[^\d.]/g, "")
                      )
                    }
                    placeholder="0.00"
                    inputMode="decimal"
                    className="pl-7"
                  />
                </div>
              </FieldRow>
            )}
          </div>
        );
      })}

      <Button variant="outline" onClick={addService} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add service
      </Button>
    </div>
  );
}
