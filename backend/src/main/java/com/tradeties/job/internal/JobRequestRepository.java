package com.tradeties.job.internal;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface JobRequestRepository extends JpaRepository<JobRequestRow, UUID> {

	/** Whether any request at all names this service — see {@link RequestedServices}. */
	boolean existsByServiceId(UUID serviceId);

	/** Every request sent about one job, the newest first. */
	List<JobRequestRow> findByJobIdOrderByCreatedAtDesc(UUID jobId);

	/** Every request sent to one business — the rows its inbox is made of. */
	List<JobRequestRow> findByBusinessId(UUID businessId);
}
