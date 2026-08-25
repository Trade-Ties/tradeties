import {
  AutocompleteField,
  CheckboxField,
  CheckboxGrid,
  Field,
  useFieldIds,
} from "@/components/ui/field";
import type { ReferenceData } from "@/lib/api/reference";
import { tradeOptions } from "../reference";
import type { StepProps, TradesForm } from "../types";

interface TradeStepProps extends StepProps<TradesForm> {
  reference: ReferenceData;
}

export function TradeStep({ data, update, reference }: TradeStepProps) {
  const options = tradeOptions(reference);

  /**
   * The trade being replaced keeps its claim, as an additional one.
   *
   * Naming a different main trade says which one to be found under first. It does not say the
   * old one has been given up — but the two slots are the whole selection, so leaving it out of
   * both retires it on the next save, and the services filed under it go with it. One pick from
   * a dropdown, and nothing on the screen said so.
   */
  const selectPrimary = (tradeId: string) => {
    if (tradeId === data.primaryTradeId) return;

    // The contract refuses the primary repeated among the additional ids, in either direction.
    const kept = data.additionalTradeIds.filter(
      (t) => t !== tradeId && t !== data.primaryTradeId
    );

    update({
      ...data,
      primaryTradeId: tradeId,
      additionalTradeIds:
        data.primaryTradeId === "" ? kept : [...kept, data.primaryTradeId],
    });
  };

  const toggleAdditional = (tradeId: string) => {
    const has = data.additionalTradeIds.includes(tradeId);
    update({
      ...data,
      additionalTradeIds: has
        ? data.additionalTradeIds.filter((t) => t !== tradeId)
        : [...data.additionalTradeIds, tradeId],
    });
  };

  // Only the label id: the boxes carry their own wording, and the grid is what needs naming.
  const { labelId } = useFieldIds(false);

  return (
    <>
      <AutocompleteField
        label="Primary trade"
        required
        hint="The one that best describes your main business."
        placeholder="Search"
        options={options}
        value={data.primaryTradeId}
        onValueChange={selectPrimary}
      />

      <Field
        label="Additional trades"
        labelId={labelId}
        hint="Anything else you also offer. These, and your primary trade, are what a service can be filed under."
      >
        <CheckboxGrid labelledBy={labelId} className="pt-1">
          {reference.trades.map((trade) => {
            const isPrimary = trade.id === data.primaryTradeId;
            return (
              <CheckboxField
                key={trade.id}
                label={
                  <>
                    {trade.displayName}
                    {isPrimary && <span className="text-xs">(primary)</span>}
                  </>
                }
                checked={isPrimary || data.additionalTradeIds.includes(trade.id)}
                disabled={isPrimary}
                onCheckedChange={() => toggleAdditional(trade.id)}
              />
            );
          })}
        </CheckboxGrid>
      </Field>
    </>
  );
}
