package com.tradeties.business;

import java.util.UUID;

/**
 * <strong>Declared here and implemented elsewhere</strong>, the same shape as
 * {@link CalendarReadiness} and for the same reason: {@code job} will depend on
 * {@code business}, so {@code business} must not depend back on it.
 *
 * <p>The question exists because removing a service has two right answers. One that nothing has
 * booked can be deleted; one that an appointment names must not vanish and tear up the history,
 * so it is deactivated instead.
 *
 * <p><strong>Asked rather than attempted.</strong> Trying the delete and catching the foreign key
 * violation cannot work: in PostgreSQL a failed statement aborts the whole transaction, so the
 * fallback would run where not even {@code SELECT 1} is permitted.
 *
 * <p>Deliberately narrow. A port that grew to describe <em>which</em> appointments hold the
 * service would make {@code business} a client of {@code job}.
 */
public interface ServiceUsage {

	/**
	 * @return whether anything still references it. {@code false} means it is safe to delete;
	 *         {@code true} means it has to be deactivated instead.
	 */
	boolean isReferenced(UUID serviceId);
}
