package com.tradeties.job.internal;

import java.util.UUID;

import com.tradeties.business.ServiceUsage;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The real answer to {@code business}'s question, now that there is a table that references a
 * service. It replaces {@code NoServiceReferencesYet}, which was correct only while nothing did.
 *
 * <p><strong>Every request counts, not only the live ones.</strong> A declined request from last
 * spring still names the service, and the point of keeping the row is that somebody can read what
 * was asked for. Counting only {@code PENDING} and {@code ACCEPTED} would let a tradesperson
 * remove a service the moment the last one was declined, and take the record of it with them.
 *
 * <p>What "referenced" buys is a deactivation instead of a removal: the service stays in the
 * profile marked inactive, so the requests naming it stay readable. It is not a foreign key
 * rescue — {@code business_service} is soft-deleted, so the constraint would hold either way. The
 * question is what a reader should still be able to see.
 */
@Component
class RequestedServices implements ServiceUsage {

	private final JobRequestRepository requests;

	RequestedServices(JobRequestRepository requests) {
		this.requests = requests;
	}

	@Override
	@Transactional(readOnly = true)
	public boolean isReferenced(UUID serviceId) {
		return requests.existsByServiceId(serviceId);
	}
}
