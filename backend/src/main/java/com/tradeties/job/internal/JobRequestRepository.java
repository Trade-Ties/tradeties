package com.tradeties.job.internal;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface JobRequestRepository extends JpaRepository<JobRequestRow, UUID> {

	/** Whether any request at all names this service — see {@link RequestedServices}. */
	boolean existsByServiceId(UUID serviceId);

	/**
	 * What {@code availability} subtracts from a business's week, for several businesses at once.
	 *
	 * <p>Bounded below by the end rather than the start, so an appointment already under way still
	 * counts: it is occupying the hour being asked about.
	 */
	List<JobRequestRow> findByBusinessIdInAndStatusAndEndsAtAfter(
			Collection<UUID> businessIds, RequestStatus status, Instant notBefore);

	/** The inbox, soonest appointment first — the order the decisions are urgent in. */
	List<JobRequestRow> findByBusinessIdOrderByStartsAtAsc(UUID businessId);

	List<JobRequestRow> findByBusinessIdAndStatusOrderByStartsAtAsc(UUID businessId, RequestStatus status);

	/**
	 * Read by id <em>and</em> business, never by id alone.
	 *
	 * <p>The business comes from the access token, so a request belonging to somebody else does
	 * not answer 403 here — it simply is not found, which is the same sentence a request that
	 * never existed gets. Telling them apart would confirm the id to whoever guessed it.
	 */
	Optional<JobRequestRow> findByIdAndBusinessId(UUID id, UUID businessId);

	/**
	 * How many appointments a business has already committed to inside one of its own days.
	 *
	 * <p>Counted over an instant range the caller works out in the business's zone, because the
	 * limit is a statement about their day and a UTC day moves that boundary seven hours into the
	 * afternoon in Denver.
	 */
	int countByBusinessIdAndStatusAndStartsAtGreaterThanEqualAndStartsAtLessThan(
			UUID businessId, RequestStatus status, Instant dayStart, Instant dayEnd);

	/** Accepted appointments that could collide with a span, for the business being written to. */
	List<JobRequestRow> findByBusinessIdAndStatusAndEndsAtAfterAndStartsAtBefore(
			UUID businessId, RequestStatus status, Instant from, Instant to);
}
