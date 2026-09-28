package com.tradeties.job.internal;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface JobRequestRepository extends JpaRepository<JobRequestRow, UUID> {

	/** Whether any request at all names this service — see {@link RequestedServices}. */
	boolean existsByServiceId(UUID serviceId);
}
