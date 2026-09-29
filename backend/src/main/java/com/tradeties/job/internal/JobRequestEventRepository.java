package com.tradeties.job.internal;

import java.util.UUID;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Append and count, nothing else: there is no update or delete to inherit by accident. */
interface JobRequestEventRepository extends Repository<JobRequestEventRow, UUID> {

	JobRequestEventRow save(JobRequestEventRow event);

	@Query("select coalesce(max(e.sequenceNumber), 0) from JobRequestEventRow e where e.requestId = :requestId")
	int lastSequenceOf(@Param("requestId") UUID requestId);
}
