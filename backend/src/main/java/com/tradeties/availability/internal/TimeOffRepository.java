package com.tradeties.availability.internal;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.repository.Repository;

/**
 * A bare {@link Repository} exposing exactly the writes {@link TimeOffWrites} makes. Every one of
 * them has to happen behind the calendar lock, and an inherited {@code saveAll} or
 * {@code deleteAll} would be a write path that never took it.
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

	/** The same question for one business, which is what a single write path asks before it writes. */
	List<TimeOffRow> findByBusinessIdAndEndsAtAfter(UUID businessId, Instant notBefore);

	List<TimeOffRow> findByBusinessIdAndEndsAtAfterOrderByStartsAtAsc(UUID businessId, Instant notBefore);

	/** By id and business, never by id alone: the business comes from the token. */
	Optional<TimeOffRow> findByIdAndBusinessId(UUID id, UUID businessId);

	TimeOffRow saveAndFlush(TimeOffRow row);

	void delete(TimeOffRow row);
}
