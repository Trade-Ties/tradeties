package com.tradeties.job.internal;

import java.time.Instant;

import org.springframework.stereotype.Component;

/**
 * Writes the history row for a transition. Called in the transaction that changed the request,
 * after the change, so the row can never describe a status that was rolled back.
 */
@Component
class RequestHistory {

	private final JobRequestEventRepository events;

	RequestHistory(JobRequestEventRepository events) {
		this.events = events;
	}

	/**
	 * @param from null for a request that has just come into being
	 */
	void record(JobRequestRow request, RequestStatus from, Actor actor, String note) {
		events.save(new JobRequestEventRow(request.id(), events.lastSequenceOf(request.id()) + 1,
				from, request.status(), actor, note, Instant.now()));
	}
}
