package com.tradeties.job.internal;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.tradeties.availability.AcceptedAppointments;
import com.tradeties.availability.BookedSpan;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tells {@code availability} which hours are spoken for, which is the fact it cannot hold itself.
 *
 * <p>Only {@code ACCEPTED} counts. A pending request is somebody waiting for an answer and must
 * not take the hour off anybody else's screen — DECISIONS section 1 makes that a rule rather than
 * an accident, and it is the whole reason two customers may ask for one hour.
 */
@Service
class AcceptedAppointmentsAdapter implements AcceptedAppointments {

	private final JobRequestRepository requests;

	AcceptedAppointmentsAdapter(JobRequestRepository requests) {
		this.requests = requests;
	}

	@Override
	@Transactional(readOnly = true)
	public Map<UUID, List<BookedSpan>> endingAfter(Collection<UUID> businessIds, Instant notBefore) {
		if (businessIds.isEmpty()) {
			return Map.of();
		}

		return requests
				.findByBusinessIdInAndStatusAndEndsAtAfter(businessIds, RequestStatus.ACCEPTED, notBefore)
				.stream()
				.collect(Collectors.groupingBy(JobRequestRow::businessId,
						Collectors.mapping(row -> new BookedSpan(row.startsAt(), row.endsAt()),
								Collectors.toList())));
	}
}
