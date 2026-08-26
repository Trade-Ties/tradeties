import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import {
  AutocompleteField,
  Field,
  FieldGrid,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { ReferenceData } from "@/lib/api/reference";
import { CollapsibleRow, EmptyList } from "../CollapsibleRow";
import { makeEmptyService } from "../defaults";
import { FIELD_MAX } from "../limits";
import { DURATION_OPTIONS, PRICING_MODES } from "../options";
import { MoneyField } from "../AmountField";
import { tradeName } from "../reference";
import { useRowList } from "../rowList";
import type { ServiceForm } from "../types";
import { statesAnAmount } from "../toWire";
import {
  duplicateServiceNames,
  serviceNameKey,
  serviceProblem,
  serviceTradeIsGone,
} from "../validate";

interface ServicesStepProps {
  data: ServiceForm[];
  update: (value: ServiceForm[]) => void;
  reference: ReferenceData;
  selectedTradeIds: string[];
}

/** What tells a copy from what it was copied from, and the room the name has to leave for it. */
const COPY_MARKER = " (copy)";

function durationLabel(minutes: number): string {
  return DURATION_OPTIONS.find((d) => d.value === minutes)?.label ?? `${minutes} min`;
}

function priceLabel(service: ServiceForm): string {
  // What the wire will carry rather than what the box holds: a bare "." is not empty and is sent
  // as no price at all, and a row summarising itself as "$." contradicts its own badge.
  const amount = statesAnAmount(service.price) ? service.price.trim() : "";

  switch (service.pricingMode) {
    case "QUOTE_ONLY":
      return "Quote only";
    case "HOURLY":
      return amount === "" ? "Standard rate" : `$${amount}/h`;
    case "STARTING_AT":
      return amount === "" ? "—" : `from $${amount}`;
    default:
      return amount === "" ? "—" : `$${amount}`;
  }
}

export function ServicesStep({
  data,
  update,
  reference,
  selectedTradeIds,
}: ServicesStepProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const rows = useRowList(data, update);

  const duplicateService = (service: ServiceForm, idx: number) =>
    // A copy is a new row, so it keeps neither the server id nor the version — otherwise the
    // next save would replace the original with its own duplicate.
    rows.insertAfter(idx, (key) => ({
      ...service,
      key,
      serverId: undefined,
      version: undefined,
      // The name is trimmed to leave room for the marker rather than the marker being dropped:
      // the box's own `maxLength` does not apply to a value set in code, and a name over the
      // contract's 160 is a 400 whose whole message is "Invalid request content."
      name: `${service.name.slice(0, FIELD_MAX.serviceName - COPY_MARKER.length)}${COPY_MARKER}`,
    }));

  /**
   * Name must be unique within the business. Shared with the save path rather than stated here,
   * so a row this badges is a row that is held back — see `serviceIsWritable`.
   */
  const duplicates = useMemo(() => duplicateServiceNames(data), [data]);

  /**
   * The trades picked above, and nothing else — a service sits under exactly one of them. An id
   * the catalogue no longer resolves is dropped rather than offered as a choice with no word for
   * it, which is also why a new row takes its default from this list rather than from
   * `selectedTradeIds` directly.
   */
  const serviceTradeOptions = useMemo(
    () =>
      selectedTradeIds
        .map((id) => ({ value: id, label: tradeName(reference, id) }))
        .filter((option) => option.label !== ""),
    [reference, selectedTradeIds]
  );

  // The primary trade comes first, so this is the trade the business leads with. Empty until
  // step 3 has been answered, which is the one case a new row starts without one.
  const defaultTradeId = serviceTradeOptions[0]?.value ?? "";

  const claimed = useMemo(() => new Set(selectedTradeIds), [selectedTradeIds]);

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...data];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    update(next);
    setDragIndex(null);
  };

  return (
    <Field
      label="Services"
      hint="What clients can book. Drag to set the order they see them in."
      labelAction={data.length > 0 ? `${data.length} listed` : undefined}
    >
      <div className="space-y-2 pt-1">
        {data.length === 0 && (
          <EmptyList>No services yet. Add the first thing a client can book you for.</EmptyList>
        )}

        {data.map((service, idx) => {
          const isOpen = rows.openId === service.key;
          const name = service.name.trim();
          const isDuplicate = duplicates.has(serviceNameKey(service) ?? "");
          const showPrice = service.pricingMode !== "QUOTE_ONLY";
          const priceOptional = service.pricingMode === "HOURLY";

          // Resolved against the whole catalogue rather than the dropdown above, so a service
          // still names its trade while the catalogue and the selection disagree.
          const tradeLabel = tradeName(reference, service.tradeId);

          /**
           * The trade above was unticked and this row is still filed under it.
           *
           * Shown rather than swept away: nothing has been sent yet, so putting the trade back
           * has to put this back with it. What it cannot be is written — the composite foreign
           * key refuses it, as a 400 about the whole step — so the row says so here and
           * `serviceIsWritable` holds it back, and saving the step is where it is finally spent.
           */
          const tradeIsGone = serviceTradeIsGone(service, claimed);

          // Shared with `serviceIsWritable`, so what the row is badged with and what the save
          // holds back are the same answer rather than two guesses at it.
          const problem = serviceProblem(service, duplicates, claimed);

          const rowName = name === "" ? `service ${idx + 1}` : service.name;

          // The row's own trade stays in its own dropdown once it has been unticked, or the
          // control holds a value that is not among its options and reads as empty.
          const rowTradeOptions =
            tradeIsGone && tradeLabel !== ""
              ? [...serviceTradeOptions, { value: service.tradeId, label: tradeLabel }]
              : serviceTradeOptions;

          return (
            <CollapsibleRow
              key={service.key}
              panelId={`service-${service.key}`}
              open={isOpen}
              onToggle={() => rows.toggle(service.key)}
              title={name === "" ? "Untitled service" : service.name}
              titleMuted={name === ""}
              problem={problem}
              summary={
                <>
                  {tradeLabel !== "" && <span>{tradeLabel}</span>}
                  <span>{durationLabel(service.estimatedDurationMinutes)}</span>
                  <span className="tabular-nums">{priceLabel(service)}</span>
                </>
              }
              leading={
                <GripVertical
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground",
                    !isOpen && "cursor-grab active:cursor-grabbing"
                  )}
                />
              }
              actions={
                <>
                  <IconButton
                    label={`Duplicate ${rowName}`}
                    onClick={() => duplicateService(service, idx)}
                  >
                    <Copy className="size-4" />
                  </IconButton>
                  <IconButton
                    label={`Remove ${rowName}`}
                    onClick={() => rows.remove(service.key)}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </>
              }
              panelClassName="space-y-4 p-4"
              // Only while folded: `draggable` on a container holding text inputs costs you the
              // ability to select their contents with the mouse.
              draggable={!isOpen}
              onDragStart={(e) => {
                // Firefox cancels a drag whose handler leaves the `dataTransfer` empty, and
                // there is no second way to reorder. The payload is never read back — setting
                // one is what starts the drag, and `dragIndex` carries the row.
                e.dataTransfer.setData("text/plain", String(idx));
                e.dataTransfer.effectAllowed = "move";
                setDragIndex(idx);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => setDragIndex(null)}
              className={cn("transition-opacity", dragIndex === idx && "opacity-50")}
            >
              <FieldGrid columns={3}>
                <TextField
                  label="Name"
                  required
                  autoFocus={rows.focusId === service.key}
                  fieldClassName="sm:col-span-2"
                  value={service.name}
                  maxLength={FIELD_MAX.serviceName}
                  placeholder="e.g. Clog removal"
                  error={
                    isDuplicate ? "You already have a service with this name." : undefined
                  }
                  onChange={(e) => rows.edit(service.key, "name", e.target.value)}
                />

                <AutocompleteField
                  label="Trade"
                  required
                  placeholder="Search"
                  options={rowTradeOptions}
                  value={service.tradeId}
                  error={
                    service.tradeId === ""
                      ? "Choose one of the trades you offer."
                      : tradeIsGone
                        ? `You no longer offer ${tradeLabel || "that trade"}. Pick another ` +
                          "trade, or this service goes with it when the step is saved."
                        : undefined
                  }
                  onValueChange={(tradeId) => rows.edit(service.key, "tradeId", tradeId)}
                />
              </FieldGrid>

              <FieldGrid columns={3}>
                <SelectField
                  label="Calendar duration"
                  required
                  hint="Time reserved in your calendar."
                  options={DURATION_OPTIONS}
                  value={service.estimatedDurationMinutes}
                  onValueChange={(minutes) =>
                    rows.edit(service.key, "estimatedDurationMinutes", minutes)
                  }
                />

                <SelectField
                  label="Price model"
                  required
                  options={PRICING_MODES}
                  value={service.pricingMode}
                  onValueChange={(mode) => rows.edit(service.key, "pricingMode", mode)}
                />

                {showPrice && (
                  <MoneyField
                    label={priceOptional ? "Different hourly rate" : "Price"}
                    required={!priceOptional}
                    hint={priceOptional ? "Empty uses your standard hourly rate." : undefined}
                    value={service.price}
                    onValueChange={(price) => rows.edit(service.key, "price", price)}
                  />
                )}
              </FieldGrid>

              {/* Capped like the name above it, and for the same reason: `ServiceInput`
                  stops at 2000, and a pasted body past it is a 400 about the whole step
                  naming neither the field nor the row. */}
              <TextareaField
                label="Description"
                rows={2}
                maxLength={FIELD_MAX.serviceDescription}
                value={service.description}
                placeholder="What's included in this service?"
                onChange={(e) => rows.edit(service.key, "description", e.target.value)}
              />
            </CollapsibleRow>
          );
        })}

        <Button
          variant="outline"
          onClick={() => rows.add((key) => makeEmptyService(key, defaultTradeId))}
          className="w-full"
        >
          <Plus className="mr-2 size-4" />
          Add service
        </Button>
      </div>
    </Field>
  );
}
