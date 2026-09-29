package com.tradeties.business;

import java.util.Optional;
import java.util.UUID;

/**
 * What {@code job} is allowed to ask {@code business}: can this service, of this business, be
 * asked for — and on what terms.
 *
 * <p>A port beside {@link Businesses} rather than a method on it. That one answers "which
 * business does this account own", asked on every write a tradesperson makes; this one answers a
 * customer's question about a business they do not own, and the two have no caller in common.
 *
 * <p>The arrow runs {@code job → business} and never back. A profile knows nothing about the
 * requests sent to it, which is what lets a business be edited without touching a single request
 * — the terms were copied, not linked.
 */
public interface BookableServices {

	/**
	 * @param slug the business as the customer reached it, which is the only name they have for
	 *        it. Resolved here rather than by the caller so that "published" stays one definition
	 * @return empty when no published business holds that slug, or when it holds it but does not
	 *         offer this service. <strong>The two are deliberately one answer here and two
	 *         answers above:</strong> the caller turns the first into a 404 and the second into a
	 *         400, and it can tell them apart because it has already read the profile
	 */
	Optional<BookableService> find(String slug, UUID serviceId);

	/**
	 * Whether a published business holds this slug at all, regardless of its services.
	 *
	 * <p>Separate so a caller can answer "no such business" differently from "not that service".
	 * A customer who mistyped an address and one following a link to a service since withdrawn
	 * need different sentences, and only one of them should reload.
	 */
	boolean isPublished(String slug);

	/**
	 * The same terms, for a business booking one of its own services itself — published or not,
	 * since a business that has gone offline still keeps its regulars.
	 *
	 * @param businessId resolved from the caller's token, never taken from a request
	 * @return empty when the service is not this business's, is inactive, or the business has no
	 *         pricing terms yet to copy
	 */
	Optional<BookableService> findOwn(UUID businessId, UUID serviceId);
}
