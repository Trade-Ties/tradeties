import { Checkbox } from "@/components/ui/checkbox";
import { FieldRow } from "../FieldRow";
import { TRADE_CATEGORIES } from "../constants";
import type { StepProps, TradeInfo } from "../types";

export function TradeStep({ data, update }: StepProps<TradeInfo>) {
  const otherTrades = TRADE_CATEGORIES.filter((t) => t !== data.primaryTrade);

  const selectPrimary = (trade: string) => {
    update({
      primaryTrade: trade,
      // if it was previously picked as an "additional" trade, drop it from there
      additionalTrades: data.additionalTrades.filter((t) => t !== trade),
    });
  };

  const toggleAdditional = (trade: string) => {
    const has = data.additionalTrades.includes(trade);
    update({
      ...data,
      additionalTrades: has
        ? data.additionalTrades.filter((t) => t !== trade)
        : [...data.additionalTrades, trade],
    });
  };

  return (
    <div className="space-y-6">
      <FieldRow
        label="Primary trade *"
        hint="Choose the one that best describes your main business"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TRADE_CATEGORIES.map((trade) => {
            const selected = data.primaryTrade === trade;
            return (
              <button
                key={trade}
                type="button"
                onClick={() => selectPrimary(trade)}
                className={[
                  "rounded-lg border-2 px-3 py-2.5 text-sm font-medium text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-muted text-muted-foreground hover:border-muted-foreground/50",
                ].join(" ")}
              >
                {trade}
              </button>
            );
          })}
        </div>
      </FieldRow>

      <FieldRow label="Additional trades" hint="Optional — anything else you also offer">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {otherTrades.map((trade) => {
            const checked = data.additionalTrades.includes(trade);
            return (
              <label
                key={trade}
                className="flex items-center gap-2 rounded-lg border p-2.5 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleAdditional(trade)}
                />
                {trade}
              </label>
            );
          })}
        </div>
      </FieldRow>
    </div>
  );
}
