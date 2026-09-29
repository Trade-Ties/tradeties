package com.tradeties.job.internal;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface JobMessageRepository extends JpaRepository<JobMessageRow, UUID> {

	/** Every thread on a page at once, oldest line first within each. */
	List<JobMessageRow> findByJobRequestIdInOrderByCreatedAtAsc(Collection<UUID> jobRequestIds);

	List<JobMessageRow> findByJobRequestIdOrderByCreatedAtAsc(UUID jobRequestId);

	/**
	 * Everything the customer wrote on one request, seen. One statement rather than a loop over
	 * rows, and only ever stamping a message once: a second opening must not move the time the
	 * first one recorded.
	 */
	@Modifying
	@Query("""
			UPDATE JobMessageRow m SET m.readAt = :now
			WHERE m.jobRequestId = :requestId
			  AND m.author = com.tradeties.job.internal.JobMessageRow.Author.CUSTOMER
			  AND m.readAt IS NULL
			""")
	int markCustomerMessagesRead(@Param("requestId") UUID requestId, @Param("now") Instant now);
}
