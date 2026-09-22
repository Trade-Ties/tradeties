"use client";

import { useState, useTransition } from "react";

import { dismiss, promote } from "@/app/(pro)/admin/catalog/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogSuggestion } from "@/lib/api/admin";
import type { Trade } from "@/lib/api/reference";

/**
 * One collected phrase, and the two things that can be done about it.
 *
 * **The label starts empty on purpose.** Prefilling it with the phrase would invite promoting the
 * phrase, and the phrase is not the job: "my chimney flue is cracked" is how somebody described a
 * problem, "Repair a cracked chimney flue" is what the marketplace should call it. Making that
 * translation is the whole reason a person is here rather than a rule that promotes by count.
 */
export function SuggestionRow({
  suggestion,
  trades,
  decidable,
}: {
  suggestion: CatalogSuggestion;
  trades: Trade[];
  decidable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [tradeId, setTradeId] = useState(trades[0]?.id ?? "");
  const [synonyms, setSynonyms] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const decide = (run: () => Promise<{ ok: true } | { ok: false; message: string }>) =>
    start(async () => {
      const outcome = await run();
      // The row disappears from this list when it succeeds — the page revalidates — so only a
      // refusal has anything to say here.
      setProblem(outcome.ok ? null : outcome.message);
    });

  return (
    <li className="rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium">{suggestion.phrase}</span>
        <span className="text-sm text-muted-foreground">
          {suggestion.seenCount}× · {suggestion.source === "PRO" ? "a tradesperson" : "customers"} ·
          first seen {new Date(suggestion.firstSeenAt).toLocaleDateString()}
        </span>

        {decidable && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen((was) => !was)}>
              {open ? "Cancel" : "Name it"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => decide(() => dismiss(suggestion.id))}
            >
              Not a job
            </Button>
          </div>
        )}
      </div>

      {open && decidable && (
        <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor={`label-${suggestion.id}`}>What the marketplace calls it</Label>
            <Input
              id={`label-${suggestion.id}`}
              value={label}
              maxLength={120}
              placeholder="Repair a cracked chimney flue"
              onChange={(e) => setLabel(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              In the customer&apos;s words, not theirs. This is the text they search against.
            </p>
          </div>

          <div>
            <Label htmlFor={`trade-${suggestion.id}`}>Trade</Label>
            <select
              id={`trade-${suggestion.id}`}
              value={tradeId}
              onChange={(e) => setTradeId(e.target.value)}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              {trades.map((trade) => (
                <option key={trade.id} value={trade.id}>
                  {trade.displayName}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Decides who can offer it — only businesses holding this trade.
            </p>
          </div>

          <div>
            <Label htmlFor={`synonyms-${suggestion.id}`}>Other words for it</Label>
            <Input
              id={`synonyms-${suggestion.id}`}
              value={synonyms}
              maxLength={2000}
              placeholder="flue, cracked flue, smoke coming into the room"
              onChange={(e) => setSynonyms(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Comma-separated, and worth more than the label for being found. Both what customers
              type and what the trade calls it.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Button
              disabled={pending || label.trim() === "" || tradeId === ""}
              onClick={() => decide(() => promote(suggestion.id, label.trim(), tradeId, synonyms))}
            >
              Add to the catalogue
            </Button>
          </div>
        </div>
      )}

      {suggestion.promotedTo && (
        <p className="mt-2 text-sm text-muted-foreground">Became a catalogue job.</p>
      )}

      {problem && <p className="mt-3 text-sm text-destructive">{problem}</p>}
    </li>
  );
}
