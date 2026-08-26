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

/**
 * Where the wizard lives.
 *
 * One copy because the three callers fail differently when they drift: the dashboard link goes
 * dead loudly, but a stale `revalidatePath` target just stops invalidating and serves cached
 * data with no symptom at all.
 */
export const WIZARD_PATH = "/profile/create";
