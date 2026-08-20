/**
 * Business — the tradesperson's shop as customers will eventually see it.
 *
 * <p>Owns the profile and the three catalogues it is built from: the trades on offer, the US
 * states a business can operate and hold a licence in, and the time zones its working hours are
 * read against.
 *
 * <p>Everything here is addressed as {@code /api/v1/me/business/...} and resolved from the access
 * token. The business id is never a path variable, so the oldest hole in a multi-tenant API — put
 * someone else's id in the URL and edit their data — has no door to knock on.
 *
 * <p>The catalogues are served from here rather than from a module of their own because this is
 * their only consumer today. When {@code job} needs the state list, moving them is a package
 * move.
 */
@org.springframework.modulith.ApplicationModule(displayName = "Business")
package com.tradeties.business;
