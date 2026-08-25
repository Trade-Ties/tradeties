"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CONTROL_HEIGHT, Field, useFieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { SLUG_CHARACTER, useCaret } from "./caret";
import {
  PROFILE_URL_PREFIX,
  SLUG_MAX,
  isCompleteSlug,
  slugAsTyped,
  slugSuggestions,
  slugify,
} from "./slug";

type SlugState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "free" }
  | { status: "taken" }
  | { status: "unknown" };

/** How long typing has to stop before the URL itself is checked. */
const CHECK_DELAY_MS = 400;

/**
 * Longer, for the alternatives. They are built from the town and the state, so they re-run on an
 * address typed further down the same screen, and each run is one request per candidate.
 */
const SUGGEST_DELAY_MS = 900;

/**
 * What the field says when the question could not be put or could not be answered. Its own
 * sentence rather than the server's, which is written about a request and would read under a
 * URL box as if the name were wrong.
 */
const COULD_NOT_CHECK = "The name could not be checked just now.";

/** At most two. A list of alternatives is a decision; two is a suggestion. */
const SUGGESTIONS_SHOWN = 2;

/**
 * Runs `work` once typing has paused, and only while the newest run is still the current one.
 *
 * Three guarantees, shared by both questions this field asks the server: a timer cleared on the
 * way out, so a fast typist makes no requests at all; a generation counter, so a slow answer
 * landing after a newer one cannot overwrite it; and a gate on `when`, so nothing is asked
 * about a value there is no question for.
 *
 * `work` is handed `isCurrent` rather than being cut short on its behalf, because it has to be
 * checked after the await.
 */
function useAfterAPause(
  when: boolean,
  delayMs: number,
  work: (isCurrent: () => boolean) => void | Promise<void>,
  deps: React.DependencyList
) {
  const generation = useRef(0);

  useEffect(() => {
    if (!when) return;

    const mine = ++generation.current;
    const timer = setTimeout(() => void work(() => generation.current === mine), delayMs);

    return () => clearTimeout(timer);
    // The caller states what the run depends on; `work` is rebuilt every render by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

interface ProfileUrlFieldProps {
  slug: string;
  /**
   * Where the business works, for an alternative when the URL is taken.
   *
   * Available here because the wizard puts steps 1 and 2 on one screen: the address is the
   * next thing down the page, editing the same slice of the form.
   */
  city: string;
  state: string;
  /**
   * Whether the URL has stopped being theirs to change, which the first publish decides.
   *
   * The server owns the rule and refuses a changed slug with a 409. This is what keeps the
   * field from offering an edit that could only end in one.
   */
  locked: boolean;
  onChange: (slug: string) => void;
  /**
   * Whether that URL is free, asked of whoever mounted this field.
   *
   * A prop rather than an import of one route's server actions: a leaf that reaches around the
   * module owning the actions boundary can only be mounted where that route exists.
   */
  check: (slug: string) => Promise<SlugAnswer>;
}

/** What the checker can answer. `null` for a question that could not be put at all. */
export type SlugAnswer = { available: boolean } | null;

/**
 * The profile URL, shown as a settled statement with a way in rather than as a box.
 *
 * Unlike everything else on this screen it is an address other people hold copies of — on a
 * van, on an invoice, in somebody's bookmarks — so it is edited only on purpose.
 *
 * The prefix is part of the control rather than of the hint, in both states: what the box holds
 * is the one piece that is theirs to choose.
 */
export function ProfileUrlField({
  slug,
  city,
  state,
  locked,
  onChange,
  check,
}: ProfileUrlFieldProps) {
  const { controlId: id, messageId, describedBy } = useFieldIds(true);
  const [editing, setEditing] = useState(false);
  /**
   * The last answer, and the slug it was about. A pair rather than a bare status so "checking"
   * needs no state of its own: a slug the recorded answer is not about is one still being asked
   * about.
   */
  const [checked, setChecked] = useState<{ slug: string; answer: SlugState } | null>(null);
  /** The alternatives that came back free, and the slug they were alternatives to. */
  const [suggested, setSuggested] = useState<{ slug: string; options: string[] } | null>(null);
  /**
   * Every candidate the server has ruled on, whether or not it was offered.
   *
   * A ref rather than state: nothing renders from it, and a new answer must not itself cause the
   * render that asks for the next one. Candidates are proposed from the town, so typing "Denver"
   * proposes the "denv…" family six times over and only the last spelling is a new question.
   */
  const answered = useRef(new Map<string, boolean>());
  /**
   * The box rewrites every keystroke — a space becomes a hyphen, a capital becomes lower case —
   * so the caret has to be put back afterwards. See `caret.ts`.
   */
  const keepCaret = useCaret();

  /**
   * Nothing to ask about an empty box, a URL nobody can move, or one still being typed.
   *
   * `slugAsTyped` keeps the trailing hyphen of "joes-" on purpose — it is the only way to type
   * the hyphen in "joes-plumbing" — but the endpoint puts the contract's `Slug` pattern on its
   * query parameter, so asking there could only come back 400 and print a validation sentence
   * under a URL that is half typed rather than wrong.
   *
   * The business's own slug is deliberately not special-cased: the endpoint reports a slug the
   * caller already holds as free, because it is not taken from them. See `isSlugAvailableFor`.
   */
  const shouldCheck = !locked && isCompleteSlug(slug);

  /**
   * What the field says right now, worked out rather than stored, so there is no moment where a
   * stale answer is shown beside a new value while a re-render catches up.
   */
  const slugState: SlugState = !shouldCheck
    ? { status: "idle" }
    : checked?.slug === slug
      ? checked.answer
      : { status: "checking" };

  const taken = slugState.status === "taken";

  /**
   * The live availability check, one request per pause in typing.
   *
   * It runs whether or not the box is open, which is the point: the URL is proposed from the
   * display name, so somebody who never touches this field can still be carrying one another
   * business holds, and would hear about it from a 409 at the end of the step instead.
   */
  useAfterAPause(shouldCheck, CHECK_DELAY_MS, async (isCurrent) => {
    let answer: SlugState;

    try {
      const result = await check(slug);

      answer =
        result === null ? { status: "unknown" } : { status: result.available ? "free" : "taken" };
    } catch {
      // `check` answers a refusal by the server with `null`; this is the call failing to get
      // there at all. Without this branch `setChecked` is never reached, so the field reads
      // "Checking…" for the rest of the session with nothing to retry but editing the box.
      answer = { status: "unknown" };
    }

    if (!isCurrent()) return;

    setChecked({ slug, answer });
  }, [slug, shouldCheck, check]);

  /**
   * Alternatives, asked for only once the answer is "taken".
   *
   * Every candidate is checked rather than shown on trust: two businesses of the same name in
   * the same town is the collision this is answering, and offering a second URL that is also
   * gone would be worse than offering none.
   *
   * Debounced harder than the check above — see `SUGGEST_DELAY_MS` — and every answer is kept,
   * because a town typed one letter at a time proposes the same candidates over and over.
   */
  useAfterAPause(taken, SUGGEST_DELAY_MS, async (isCurrent) => {
    const candidates = slugSuggestions(slug, city, state);
    if (candidates.length === 0) return;

    const answers = await Promise.all(
      candidates.map(async (candidate) => {
        const known = answered.current.get(candidate);
        if (known !== undefined) return known ? candidate : null;

        const result = await check(candidate);
        // Only a real answer is remembered. A call that could not be made says nothing about
        // the candidate, and caching it would settle the question for the rest of the session.
        if (result !== null) answered.current.set(candidate, result.available);

        return result?.available ? candidate : null;
      })
    );

    if (!isCurrent()) return;

    setSuggested({
      slug,
      options: answers
        .filter((candidate): candidate is string => candidate !== null)
        .slice(0, SUGGESTIONS_SHOWN),
    });
  }, [taken, slug, city, state, check]);

  const options = taken && suggested?.slug === slug ? suggested.options : [];

  /**
   * Leaving the box tidies the value and closes it, unless something still needs an answer —
   * closing then would put the calm view back over the thing that needs looking at.
   */
  const finishEditing = () => {
    // Only when it makes a difference: reporting a change that is not one marks the URL as
    // taken over by hand, and it should go on following the display name.
    const tidied = slugify(slug);
    if (tidied !== slug) onChange(tidied);

    if (slug !== "" && !taken && slugState.status !== "unknown") {
      setEditing(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Field
        label="Profile URL"
        htmlFor={editing ? id : undefined}
        required={!locked}
        labelAction={
          editing ? statusLabel(slugState) : changeButton(locked, () => setEditing(true))
        }
        error={errorFor(slugState)}
        hint={hintFor(locked, editing)}
        messageId={messageId}
      >
        {editing ? (
          <div className="flex">
            <span
              className={cn(
                CONTROL_HEIGHT,
                "flex shrink-0 items-center rounded-l-lg border border-r-0 border-input",
                "bg-muted px-2.5 text-sm text-muted-foreground"
              )}
            >
              {PROFILE_URL_PREFIX}
            </span>
            <Input
              id={id}
              autoFocus
              placeholder="joes-plumbing"
              value={slug}
              maxLength={SLUG_MAX}
              // `aria-required` rather than the native attribute — see `TextField`.
              aria-required
              // Both "That URL is already taken." and the availability hint live in that line;
              // without it the box announces a complaint and never its reason.
              aria-describedby={describedBy}
              aria-invalid={taken ? true : undefined}
              className={cn(CONTROL_HEIGHT, "rounded-l-none")}
              onChange={(event) => {
                const typed = slugAsTyped(event.target.value);

                keepCaret(event, typed, SLUG_CHARACTER);
                onChange(typed);
              }}
              onBlur={finishEditing}
            />
          </div>
        ) : (
          <p className={cn(CONTROL_HEIGHT, "flex items-center text-sm break-all")}>
            <span className="text-muted-foreground">{PROFILE_URL_PREFIX}</span>
            {slug === "" ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className="font-medium">{slug}</span>
            )}
          </p>
        )}
      </Field>

      {options.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Still free:</span>
          {options.map((option) => (
            <Button
              key={option}
              variant="outline"
              size="xs"
              className="font-normal"
              onClick={() => onChange(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/** "Taken" is deliberately absent: it is an error rather than a status, and `errorFor` says it. */
function statusLabel(state: SlugState): string | undefined {
  switch (state.status) {
    case "checking":
      return "Checking…";
    case "free":
      return "Available";
    default:
      return undefined;
  }
}

/**
 * The way into the box, and nothing at all once the URL is fixed. A disabled button would say
 * "not now" when there is no later; the hint says what happened instead.
 */
function changeButton(locked: boolean, onEdit: () => void): React.ReactNode {
  if (locked) return undefined;

  return (
    <Button variant="link" size="xs" className="h-auto p-0 font-normal" onClick={onEdit}>
      Change
    </Button>
  );
}

function errorFor(state: SlugState): string | undefined {
  if (state.status === "taken") return "That URL is already taken.";
  if (state.status === "unknown") return COULD_NOT_CHECK;

  return undefined;
}

function hintFor(locked: boolean, editing: boolean): string {
  if (locked) {
    return "Fixed when you published. Customers, printed links and search results point at it.";
  }
  if (editing) {
    return "Lower case letters, numbers and hyphens.";
  }

  return "Suggested from your display name. It is fixed once you publish.";
}
