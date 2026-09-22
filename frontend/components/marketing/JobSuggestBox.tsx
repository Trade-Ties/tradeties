"use client";

import { useEffect, useState } from "react";

import {
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteInputGroup,
  AutocompleteList,
} from "@/components/ui/autocomplete";
import { Suggest, SuggestItem } from "@/components/ui/suggest";
import type { ServiceSuggestion } from "@/lib/api/marketplace";
import { cn } from "@/lib/utils";

/** Below this the list would be most of the catalogue, which is a menu rather than a suggestion. */
const ENOUGH_TO_NARROW = 2;

/**
 * Long enough that a fast typist sends one request per word rather than per letter, short enough
 * that the list has arrived by the time they stop to look at it.
 */
const SETTLE_MS = 150;

type JobSuggestBoxProps = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  /**
   * The `code` of the suggestion the text now matches, or null.
   *
   * Reported alongside the text rather than instead of it: the box stays free text, and the code
   * is the extra certainty that a customer chose from the list instead of describing something.
   * Editing the text past a suggestion clears it, which is the right reading — an edited sentence
   * is no longer the thing that was picked.
   */
  onPickedChange: (code: string | null) => void;
  /** The customer's ZIP, if they have filled it in yet. Five digits or it is not sent. */
  zip: string;
  placeholder: string;
  maxLength: number;
  className?: string;
};

/**
 * The "what's wrong?" box, with the catalogue behind it.
 *
 * **The typed text is still the answer.** Built on `Suggest` rather than the combobox for the
 * reason that component gives: the list is a shortcut, not the set of allowed values. Somebody
 * whose problem is not in the catalogue types it out and searches, exactly as before — the
 * suggestions are how the rest stop having their sentence guessed at.
 *
 * **`mode="none"` is load-bearing.** The kit filters `items` against the typed text by default,
 * and that would quietly undo the point of the endpoint: the server matches synonyms, so typing
 * "rooter" returns "Clear a blocked main sewer line" — a label containing no "rooter" for a
 * client-side filter to keep. Every list this receives is already the answer.
 */
export function JobSuggestBox({
  id,
  value,
  onValueChange,
  onPickedChange,
  zip,
  placeholder,
  maxLength,
  className,
}: JobSuggestBoxProps) {
  const [answered, setAnswered] = useState<ServiceSuggestion[]>([]);
  const typed = value.trim();

  /**
   * Derived rather than stored, and not only to satisfy the lint rule that says so. An emptied
   * box is not a fact about the network — it is a fact about the box — so writing it into the
   * same state the answers live in would mean two sources for one list, which is how a stale
   * dropdown outlives the text it belongs to.
   *
   * The last answer stays visible while the next is in flight, which is what stops the list
   * blinking out on every keystroke.
   */
  const suggestions = typed.length < ENOUGH_TO_NARROW ? [] : answered;

  useEffect(() => {
    if (typed.length < ENOUGH_TO_NARROW) {
      return;
    }

    // One request in flight at a time: the cleanup runs on the next keystroke, so an answer to
    // "dra" can never land after the answer to "drain" and put the shorter list back.
    const inFlight = new AbortController();

    const settled = setTimeout(async () => {
      const params = new URLSearchParams({ q: typed });
      if (zip.length === 5) params.set("zip", zip);

      try {
        const response = await fetch(`/api/service-catalog?${params}`, { signal: inFlight.signal });
        setAnswered(response.ok ? await response.json() : []);
      } catch {
        // Aborted, or the network is gone. Neither is worth showing somebody mid-sentence, and
        // leaving the previous list up is less startling than emptying it under their cursor.
      }
    }, SETTLE_MS);

    return () => {
      clearTimeout(settled);
      inFlight.abort();
    };
    // The trimmed text rather than the raw box: a trailing space is not a different question,
    // and depending on it would spend a request on the space bar.
  }, [typed, zip]);

  return (
    <Suggest<ServiceSuggestion>
      items={suggestions}
      value={value}
      onValueChange={(next) => {
        onValueChange(next);
        // Matched against the list that produced the text: an item's value is its label, so an
        // exact match is either a pick or somebody who typed a catalogue job word for word —
        // which is the same statement and deserves the same precision.
        onPickedChange(suggestions.find((s) => s.label === next)?.code ?? null);
      }}
      // The server has already decided what matches; filtering again here would drop every hit
      // that came from a synonym rather than from the label.
      mode="none"
    >
      <AutocompleteInputGroup>
        <AutocompleteInput
          id={id}
          placeholder={placeholder}
          maxLength={maxLength}
          className={className}
        />
      </AutocompleteInputGroup>
      {/* Nothing stands in for an empty list. A job the catalogue has no name for is a search
          worth running, not a dead end, so the popup simply goes away and the box behaves as it
          always did. */}
      <AutocompleteContent className="data-empty:hidden">
        <AutocompleteList>
          {(suggestion: ServiceSuggestion) => (
            <SuggestItem key={suggestion.code} value={suggestion.label} className="h-auto py-2">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[14.5px] font-medium text-brand">
                  {suggestion.label}
                </span>
                <span className="truncate text-[12px] text-faint">
                  {suggestion.tradeDisplayName}
                  {/* Only ever drawn for an explicit false. Absent means no ZIP was given, and
                      telling somebody nobody can help before they have said where they are is
                      the one thing this flag must not do. */}
                  {suggestion.offeredNearby === false && (
                    <span className="text-faint"> · nobody nearby offers this yet</span>
                  )}
                </span>
              </span>
            </SuggestItem>
          )}
        </AutocompleteList>
      </AutocompleteContent>
    </Suggest>
  );
}

/** Kept beside the component so a caller can style the input without importing the kit. */
export const JOB_INPUT_CLASS = cn(
  "h-auto w-full border-0 bg-transparent p-0 text-[15.5px] font-medium text-brand shadow-none",
  "outline-none placeholder:font-normal placeholder:text-faint focus-visible:ring-0",
);
