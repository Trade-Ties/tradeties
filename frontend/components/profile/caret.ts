"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Keeping the caret where the typist left it, in a box that rewrites what they type.
 *
 * Three fields on the Business screen are controlled inputs whose value is re-formatted on every
 * keystroke — the phone number, the ZIP code and the profile URL. React hands the formatted
 * string back to the DOM by assigning `node.value`, and assigning to `value` collapses the
 * selection to the end. So every mid-string edit throws the caret to the end of the box, and
 * correcting a typo in the middle of a phone number means retyping the tail.
 *
 * It goes wrong on any keystroke whose formatted result differs from what the browser produced,
 * which is not the same as the length changing: typing an upper-case letter into the URL is
 * enough, because `slugAsTyped` lower-cases it.
 */

/**
 * The caret has to go back in the same frame the value is written, or it is visibly at the end
 * for one paint. That is what `useLayoutEffect` is for — and React warns about it on the server,
 * where it never runs and there is no caret to move. The warning is the whole difference, so the
 * server is given the one that does not warn.
 */
const useCaretEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The characters a number's formatting rearranges around, and everything else is separators. */
export const DIGIT = /\d/;

/** What a slug is made of. Case-insensitive, because the formatter is what lower-cases it. */
export const SLUG_CHARACTER = /[a-z0-9]/i;

/**
 * The same place in the rewritten string, measured in characters that carry rather than in
 * offsets.
 *
 * An offset cannot simply be carried across: formatting adds and removes separators on both
 * sides of the caret, so offset 6 of "(303) 5" is not offset 6 of "(303) 55". What survives a
 * reformat is how many characters that mean something the typist had passed, and how many are
 * still ahead of them.
 *
 * Both are counted, and the later of the two answers is taken, because each is wrong on its own
 * in a case the other gets right. Counting forward puts the caret on the near side of a
 * separator that was just inserted — the wrong side of the hyphen the space bar became. Counting
 * back assumes the tail survived, and walks the caret backwards when the formatter truncates.
 * Neither is ever too late, so the later answer is the one that holds in both.
 *
 * @param carries what counts as a character rather than as punctuation between them
 */
function caretAfterFormatting(
  raw: string,
  caret: number,
  formatted: string,
  carries: RegExp
): number {
  let passed = 0;
  let ahead = 0;

  for (let i = 0; i < raw.length; i += 1) {
    if (!carries.test(raw[i])) continue;
    if (i < caret) passed += 1;
    else ahead += 1;
  }

  return Math.max(justPast(formatted, passed, carries), justBefore(formatted, ahead, carries));
}

/** Just past the `count`-th character that carries, or the end when fewer than that survived. */
function justPast(formatted: string, count: number, carries: RegExp): number {
  if (count === 0) return 0;

  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (carries.test(formatted[i])) {
      seen += 1;
      if (seen === count) return i + 1;
    }
  }

  return formatted.length;
}

/**
 * Just before the `count`-th character that carries, counting back. Nothing ahead is the
 * ordinary case — typing at the end — and the end is where the caret belongs.
 */
function justBefore(formatted: string, count: number, carries: RegExp): number {
  if (count === 0) return formatted.length;

  let seen = 0;
  for (let i = formatted.length - 1; i >= 0; i -= 1) {
    if (carries.test(formatted[i])) {
      seen += 1;
      if (seen === count) return i;
    }
  }

  return 0;
}

/**
 * The caret restorer for one field. Call the returned function from `onChange`, handing it the
 * event and what the formatter made of its value.
 *
 * The input node is taken from the event rather than through a ref, which is what lets this work
 * for a `TextField` without every wrapper between here and the `<input>` forwarding one. It is
 * the same node across the re-render: React reconciles it rather than replacing it.
 */
export function useCaret() {
  const pending = useRef<{ node: HTMLInputElement; at: number } | null>(null);

  useCaretEffect(() => {
    const restore = pending.current;
    pending.current = null;

    // Only the box somebody is actually typing in. Setting the selection of an unfocused input
    // gives it the caret, which would pull focus back out of wherever they have moved to.
    if (restore === null || document.activeElement !== restore.node) return;

    restore.node.setSelectionRange(restore.at, restore.at);
  });

  return (event: { currentTarget: HTMLInputElement }, formatted: string, carries: RegExp) => {
    const node = event.currentTarget;
    const caret = node.selectionStart;

    // Nothing to put right when the formatter left the value alone: React writes nothing to the
    // DOM, so the browser's own caret is already correct. `selectionStart` is null for input
    // types that have no selection to speak of.
    if (caret === null || formatted === node.value) return;

    pending.current = { node, at: caretAfterFormatting(node.value, caret, formatted, carries) };
  };
}
