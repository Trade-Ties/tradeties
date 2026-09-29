package com.tradeties.job.internal;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.tradeties.availability.RequestInTheWay;
import com.tradeties.availability.RequestsInTheWay;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code MANDATORY} on both: they run inside the time-off write, under its calendar lock, and a
 * transaction of their own would read and decline outside it.
 */
@Service
class RequestsInTheWayAdapter implements RequestsInTheWay {

	private static final List<RequestStatus> HOLDING_OR_ASKING = List.of(RequestStatus.PENDING, RequestStatus.ACCEPTED);

	private final JobRequestRepository requests;
	private final BusinessRequestReader reader;
	private final RequestHistory history;

	RequestsInTheWayAdapter(JobRequestRepository requests, BusinessRequestReader reader, RequestHistory history) {
		this.requests = requests;
		this.reader = reader;
		this.history = history;
	}

	@Override
	@Transactional(propagation = Propagation.MANDATORY)
	public List<RequestInTheWay> overlapping(UUID businessId, Instant from, Instant to) {
		return requests.findByBusinessIdAndStatusInAndEndsAtAfterAndStartsAtBeforeOrderByStartsAtAsc(
						businessId, HOLDING_OR_ASKING, from, to)
				.stream()
				.map(request -> {
					JobRow job = reader.jobFor(request);
					return new RequestInTheWay(request.id(), request.status() == RequestStatus.ACCEPTED,
							request.startsAt(), request.endsAt(), job.timeZone(), job.customerName(),
							request.serviceName());
				})
				.toList();
	}

	@Override
	@Transactional(propagation = Propagation.MANDATORY)
	public void decline(UUID businessId, Collection<UUID> requestIds, String reason, String note) {
		Instant now = Instant.now();

		for (UUID requestId : requestIds) {
			requests.findByIdAndBusinessId(requestId, businessId)
					.filter(JobRequestRow::isPending)
					.ifPresent(request -> {
						request.decline(now, reason);
						requests.save(request);
						history.record(request, RequestStatus.PENDING, Actor.BUSINESS, note);
					});
		}
	}
}
