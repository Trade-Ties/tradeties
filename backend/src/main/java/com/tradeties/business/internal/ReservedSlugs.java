package com.tradeties.business.internal;

import java.util.Set;

/**
 * The profile URLs no business may take, because the site needs them for itself.
 *
 * <p>A profile lives at the root, {@code tradeties.com/{slug}}, in the same namespace as the
 * site's own pages. A business called {@code portal} would either shadow the sign-in page or be
 * shadowed by it, and since the first publish freezes a slug for good, the collision could only
 * be settled by taking an address away from somebody who has printed it on a van.
 *
 * <p>So the list covers the routes that exist today and the ones a marketplace predictably grows
 * into. Adding a name later only stops new claims on it — a business that already holds it keeps
 * it — which is why it is generous now rather than exact.
 *
 * <p>Nothing shorter than the contract's slug pattern allows is worth listing, and nothing with a
 * character the pattern refuses: those never reach here.
 */
final class ReservedSlugs {

	private static final Set<String> RESERVED = Set.of(
			// Routes the frontend serves today.
			"api", "browse", "callback", "dashboard", "portal", "profile",

			// Accounts and signing in.
			"account", "accounts", "auth", "login", "logout", "register", "settings",
			"sign-in", "sign-out", "sign-up", "signin", "signout", "signup",

			// The marketplace's own vocabulary, which is where its next pages will be named.
			"book", "booking", "bookings", "business", "businesses", "categories", "category",
			"find", "jobs", "near", "near-me", "pro", "pros", "search", "services", "trades",

			// Company, help and legal pages.
			"about", "blog", "careers", "contact", "cookies", "faq", "help", "home",
			"legal", "press", "pricing", "privacy", "security", "status", "support", "terms",

			// Infrastructure, and names that would read as TradeTies itself.
			"admin", "app", "assets", "cdn", "docs", "images", "mail", "new", "root", "static",
			"system", "tradeties", "www");

	private ReservedSlugs() {
	}

	static boolean isReserved(String slug) {
		return RESERVED.contains(slug);
	}
}
