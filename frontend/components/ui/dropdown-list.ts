/**
 * The shape every dropdown list in the kit shares — the select's and the autocomplete's alike.
 *
 * They sit next to each other in the same form and are swapped for one another as an option
 * list grows, so differing row heights read as two different controls. Kept here rather than in
 * either file, because neither owns the rule.
 */

/** Fixing the row height is what lets a count of rows be turned into a height at all. */
export const DROPDOWN_ROW_HEIGHT = "h-9";

/**
 * Ten rows, then scroll: `2.25rem` a row (`DROPDOWN_ROW_HEIGHT`) plus the list's own `p-1` at
 * each end, so the tenth row lands on the fold rather than near it.
 *
 * Then capped by `--available-height`, the room the kit measured under the field, since the
 * list is pinned below and cannot flip up to find space. The floor of four rows is for a field
 * opened near the bottom of the window, where a list squeezed to one row would be unusable.
 */
export const DROPDOWN_LIST_MAX_HEIGHT =
  "max-h-[min(23rem,max(var(--available-height),9.5rem))]";

export const DROPDOWN_LIST_CLASS = "overflow-y-auto overscroll-contain p-1 scroll-py-1";

/**
 * The width of the popup: never narrower than the field it hangs under, and free to grow past it
 * up to the room the kit measured beside it.
 *
 * A minimum rather than a fixed `w-(--anchor-width)`, because the field's width is chosen by the
 * grid it sits in and has nothing to do with how long the answers are. Cut to it, a select's
 * rows clip — they do not wrap — and an autocomplete's wrap onto a second line. `9rem` is the
 * floor under both.
 */
export const DROPDOWN_POPUP_WIDTH =
  "min-w-[max(var(--anchor-width),9rem)] max-w-(--available-width)";

/**
 * `flex flex-col` is load-bearing. This is the frame and the list inside it is the scroller, so
 * a height arriving through `className` — which is where a caller naturally puts one — lands
 * here rather than on the thing it means to shorten. Flex is what makes the list shrink to the
 * frame instead: without it the frame's `overflow-hidden` cuts a list still at its own full
 * height, and the rows past the fold are neither painted nor clickable at any scroll position.
 *
 * Only the two sides both controls can open on are listed. A popup that can also land beside its
 * field adds its own `data-[side=…]` variants on top.
 */
export const DROPDOWN_POPUP_CLASS =
  "relative isolate z-50 flex flex-col origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";

/**
 * `data-highlighted` rather than `focus:`, and it is not the same thing: the row under the
 * cursor is marked by the kit, not by the browser. The select's rows do keep focus, so they are
 * the one list that does not use this.
 *
 * Horizontal padding is the caller's: a list with a tick in the gutter needs room for it and a
 * list without one does not.
 */
export const DROPDOWN_ITEM_CLASS =
  "relative flex w-full cursor-default items-center gap-1.5 rounded-md text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50";
