import * as React from "react";

/**
 * The fields a publish-checklist line, or an Edit link elsewhere in the portal, can send somebody
 * to. Named here rather than given ids on the controls, because several of them are composites
 * (a list of services, a week of hours) whose first control is the thing to land on, and which
 * control that is depends on what the list holds right now.
 */
export const FOCUS_TARGETS = [
  "postalCode",
  "primaryTrade",
  "services",
  "hourlyRate",
  "workingHours",
  "bookingPolicy",
] as const;

export type FocusTargetName = (typeof FOCUS_TARGETS)[number];

/** A name from a link, where anything at all can arrive. */
export function isFocusTarget(value: string): value is FocusTargetName {
  return (FOCUS_TARGETS as readonly string[]).includes(value);
}

/** A hidden checkbox behind a switch is not somewhere a person can be put. */
const FOCUSABLE = [
  "input:not([type=hidden]):not([disabled]):not([hidden]):not([aria-hidden=true])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/**
 * Marks what a {@link focusTarget} call lands on.
 *
 * Two ways, because the wrapper sits in two kinds of place:
 * - around one field in a `FieldGrid` (the default): `contents`, so it adds no box and the field
 *   stays the grid item;
 * - around a whole section (`section`): a real box, spaced like its siblings. A `contents` box
 *   there takes no margin, so the gap the step puts between sections silently disappears and the
 *   section's hint runs into the next one's label. Its own sections keep their gap inside it.
 */
export function FocusTarget({
  name,
  section,
  children,
}: {
  name: FocusTargetName;
  section?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div data-focus-target={name} className={section ? "space-y-8" : "contents"}>
      {children}
    </div>
  );
}

/**
 * Puts the cursor in the first control of a marked field and scrolls it to the middle of the
 * window. Scrolled separately, because a `contents` box has no position of its own and the
 * browser's own scroll-on-focus pins the control to the window's edge — under the wizard's
 * pinned step bar or buttons.
 *
 * Returns whether anything was found, which is false while the step holding it is not rendered.
 */
export function focusTarget(name: FocusTargetName): boolean {
  const control = document
    .querySelector(`[data-focus-target="${name}"]`)
    ?.querySelector<HTMLElement>(FOCUSABLE);

  if (!control) return false;

  control.focus({ preventScroll: true });
  control.scrollIntoView({ block: "center", behavior: "smooth" });
  return true;
}
