/**
 * The paths the portal links, redirects and revalidates on, which are app-wide rather than any
 * one feature's: the same `DASHBOARD_PATH` is the sidebar's link, AuthKit's `returnTo` and what
 * a dashboard write revalidates, and those only agree while they spell it the same.
 */

import type { FocusTargetName } from "@/components/profile/focusTarget";
import type { StepKey } from "@/components/profile/types";

export const MARKETPLACE_PATH = "/";

export const PORTAL_PATH = "/portal";

/**
 * Route handlers rather than pages, which is why the links to them are plain `<a>`: they answer
 * with a redirect to WorkOS, and the client router cannot follow one off the site.
 */
export const PORTAL_SIGN_IN_PATH = `${PORTAL_PATH}/sign-in`;
export const PORTAL_SIGN_UP_PATH = `${PORTAL_PATH}/sign-up`;

export const DASHBOARD_PATH = "/dashboard";

export const PROFILE_PATH = "/dashboard/profile";

export const CALENDAR_PATH = "/dashboard/calendar";

/** The calendar showing every request still waiting for an answer, rather than one day. */
export const CALENDAR_VIEW_PARAM = "view";
export const CALENDAR_REQUESTS_PATH = `${CALENDAR_PATH}?${CALENDAR_VIEW_PARAM}=requests`;

/** The calendar opened straight into its form on "Time off" — what "Add time off" links to. */
export const CALENDAR_NEW_PARAM = "new";
export const CALENDAR_TIME_OFF_PATH = `${CALENDAR_PATH}?${CALENDAR_NEW_PARAM}=time-off`;

export const INBOX_PATH = "/dashboard/inbox";

/** The inbox narrowed to what has not been read. */
export const INBOX_FILTER_PARAM = "filter";
export const INBOX_UNREAD_PATH = `${INBOX_PATH}?${INBOX_FILTER_PARAM}=unread`;

/** The inbox opened on one conversation. */
export const INBOX_CONVERSATION_PARAM = "c";
export const inboxConversationPath = (conversationId: string) =>
  `${INBOX_PATH}?${new URLSearchParams({ [INBOX_CONVERSATION_PARAM]: conversationId })}`;

export const INSIGHTS_PATH = "/dashboard/insights";

export const INVOICES_PATH = "/dashboard/invoices";

export const SETTINGS_PATH = "/dashboard/settings";

/**
 * Opens the wizard over the overview. Presence is the signal; a value naming a step opens that
 * step rather than the one the wizard would resume at, and anything else is read as presence.
 */
export const WIZARD_PARAM = "edit";

/** With a step named, the part of it to scroll to and put the cursor in. */
export const WIZARD_SECTION_PARAM = "section";

/**
 * Where the wizard lives: a view of `PROFILE_PATH` rather than a route of its own, because
 * `revalidatePath` matches on the path and never sees the query — so the wizard and the page a
 * write invalidates cannot drift apart. A stale `revalidatePath` target has no symptom; it stops
 * invalidating and serves cached data.
 */
export const WIZARD_PATH = `${PROFILE_PATH}?${WIZARD_PARAM}=1`;

/**
 * The wizard opened at one step, and optionally one section of it — what an Edit next to a
 * summary elsewhere in the portal links to, so it lands on the thing it was next to.
 */
export function wizardPathAt(step: StepKey, section?: FocusTargetName): string {
  const query = new URLSearchParams({ [WIZARD_PARAM]: step });
  if (section !== undefined) query.set(WIZARD_SECTION_PARAM, section);

  return `${PROFILE_PATH}?${query}`;
}
