package com.tradeties.business;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/**
 * What a business is called now, where its page is and how to reach it, for modules that hold
 * only its id.
 *
 * <p>A request remembers the business by id and snapshots only the terms it was sent under. The
 * name is not a term — a business that renames itself is still the one the customer asked — so it
 * is read here, current, rather than frozen onto the request.
 */
public interface BusinessNames {

	/**
	 * All of them at once, because the caller is a page listing several requests: one query for
	 * the page, not one per row. An id with no business behind it is simply absent from the map.
	 */
	Map<UUID, BusinessName> byIds(Collection<UUID> businessIds);

	/**
	 * @param email where the business asked to be contacted — the address a customer's message
	 *        is announced to
	 */
	record BusinessName(String slug, String displayName, String email) {
	}
}
