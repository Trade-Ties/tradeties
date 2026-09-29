package com.tradeties.mail.internal;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface OutboxRepository extends JpaRepository<OutboxRow, UUID> {

	/**
	 * The messages due now, locked for the pass that sends them.
	 *
	 * <p>{@code SKIP LOCKED} is what makes a second instance of the backend safe rather than a
	 * duplicate sender: each pass takes the rows nobody else holds, so two of them running at once
	 * send different messages instead of the same ones twice. Oldest first, so a backlog drains in
	 * the order it built up.
	 */
	@Query(value = """
			SELECT * FROM mail_outbox
			WHERE status = 'PENDING' AND next_attempt_at <= :now
			ORDER BY next_attempt_at
			LIMIT :batch
			FOR UPDATE SKIP LOCKED
			""", nativeQuery = true)
	List<OutboxRow> lockDue(@Param("now") Instant now, @Param("batch") int batch);
}
