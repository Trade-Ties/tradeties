/**
 * The paths the portal links, redirects and revalidates on, which are app-wide rather than any
 * one feature's: the same `DASHBOARD_PATH` is the sidebar's link, AuthKit's `returnTo` and what
 * a dashboard write revalidates, and those only agree while they spell it the same.
 */

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

export const INBOX_PATH = "/dashboard/inbox";

export const INSIGHTS_PATH = "/dashboard/insights";

export const INVOICES_PATH = "/dashboard/invoices";

export const SETTINGS_PATH = "/dashboard/settings";

/** Opens the wizard over the overview. Presence is the signal; the value is never read. */
export const WIZARD_PARAM = "edit";

/**
 * Where the wizard lives: a view of `PROFILE_PATH` rather than a route of its own, because
 * `revalidatePath` matches on the path and never sees the query — so the wizard and the page a
 * write invalidates cannot drift apart. A stale `revalidatePath` target has no symptom; it stops
 * invalidating and serves cached data.
 */
export const WIZARD_PATH = `${PROFILE_PATH}?${WIZARD_PARAM}=1`;
