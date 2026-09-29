package com.tradeties.availability;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * <strong>Declared here and implemented in {@code job}</strong>, for the reason
 * {@link AcceptedAppointments} is: time off is this module's write, and the requests it lands on
 * are {@code job}'s rows. Pointing the port this way keeps {@code job → availability} the only
 * arrow between the two.
 */
public interface RequestsInTheWay {

	/** Pending requests and accepted appointments overlapping {@code [from, to)}. */
	List<RequestInTheWay> overlapping(UUID businessId, Instant from, Instant to);

	/**
	 * Declines the pending ones among these, inside the caller's transaction, so the time off and
	 * the declines it prompted commit together or not at all. One no longer pending was answered
	 * some other way in the meantime and is left as it is.
	 *
	 * @param reason what the customers are given
	 * @param note   what the history records about the decision, for the business only
	 */
	void decline(UUID businessId, Collection<UUID> requestIds, String reason, String note);
}
