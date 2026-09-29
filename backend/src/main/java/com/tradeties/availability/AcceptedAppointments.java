package com.tradeties.availability;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * <strong>Declared here and implemented in {@code job}</strong>, which owns the rows.
 *
 * <p>The inverse of {@link CalendarGuard} and the reason both exist: free slots are working hours
 * less time off less accepted appointments, so this module needs a fact only {@code job} holds,
 * while {@code job} needs a lock and a working week only this module holds. Two narrow ports, each
 * pointing at the module that owns its answer, rather than one dependency in either direction.
 *
 * <p>Empty until something could be accepted, which is how the subtraction shipped: the
 * calculation took a list away long before there was a table to fill it.
 */
public interface AcceptedAppointments {

	/**
	 * Every appointment these businesses have committed to that has not finished yet.
	 *
	 * <p><strong>Several businesses in one call, like the time off beside it.</strong> A page of
	 * search results asks about fifty at once, and a port answering one at a time would make that
	 * fifty round trips — the mistake the batched shape of this module exists to avoid.
	 *
	 * <p>The lower bound is what stops the answer growing without limit: a business three years
	 * old has three years of finished jobs behind it, and none of them can hide an hour that has
	 * not happened yet.
	 *
	 * @param notBefore appointments ending at or before this are left out
	 * @return a list per business, businesses with none absent from the map rather than mapped to
	 *         an empty list
	 */
	Map<UUID, List<BookedSpan>> endingAfter(Collection<UUID> businessIds, Instant notBefore);
}
