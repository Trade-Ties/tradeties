package com.tradeties.availability.internal;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.repository.Repository;

/**
 * A bare {@link Repository} rather than a {@code JpaRepository}, for the same reason the customer
 * search uses one: there is nothing to write here. Time off has no writer in this application
 * yet, and inheriting twenty write methods onto a read that only subtracts would open a door
 * before anybody has decided what walking through it means.
 */
interface TimeOffRepository extends Repository<TimeOffRow, UUID> {

	/**
	 * Absences not yet over, for several businesses at once.
	 *
	 * <p>The lower bound is what stops this growing without limit. A business three years old has
	 * three years of holidays behind it, and none of them can hide a slot that has not happened
	 * yet.
	 */
	List<TimeOffRow> findByBusinessIdInAndEndsAtAfter(Collection<UUID> businessIds, Instant notBefore);
}
