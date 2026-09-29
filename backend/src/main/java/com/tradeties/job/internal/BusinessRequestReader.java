package com.tradeties.job.internal;

import com.tradeties.job.BusinessRequest;
import com.tradeties.job.RequestState;

import org.springframework.stereotype.Component;

/**
 * A request and the job it belongs to, as one thing for the business to read.
 *
 * <p>Two reads rather than a join. One business's inbox is a bounded list, and the join would buy
 * a projection to maintain in exchange for a round trip nobody is counting.
 */
@Component
class BusinessRequestReader {

	private final JobRepository jobs;

	BusinessRequestReader(JobRepository jobs) {
		this.jobs = jobs;
	}

	JobRow jobFor(JobRequestRow request) {
		return jobs.findById(request.jobId()).orElseThrow(() -> new IllegalStateException(
				"Request " + request.id() + " points at job " + request.jobId() + ", which is gone"));
	}

	BusinessRequest describe(JobRequestRow request) {
		JobRow job = jobFor(request);

		return new BusinessRequest(
				request.id(),
				RequestState.valueOf(request.status().name()),
				request.serviceId(),
				request.bookedBy(),
				job.createdBy(),
				request.startsAt(),
				request.endsAt(),
				job.timeZone(),
				request.serviceName(),
				request.estimatedDurationMinutes(),
				job.customerName(),
				job.customerEmail(),
				job.customerPhone(),
				job.preferredContact(),
				job.description(),
				job.street1(),
				job.street2(),
				job.city(),
				job.state(),
				job.postalCode(),
				request.currency(),
				request.servicePrice(),
				request.effectiveHourlyRate(),
				request.serviceCallFee(),
				request.cancellationFee(),
				request.cancellationNoticeHours(),
				request.createdAt(),
				request.decidedAt(),
				request.declineReason());
	}
}
