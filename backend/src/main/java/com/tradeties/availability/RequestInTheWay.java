package com.tradeties.availability;

import java.time.Instant;
import java.util.UUID;

/**
 * A request a new stretch of time off would cover, reduced to what the dialog answering it shows.
 *
 * @param accepted an appointment already promised, rather than a request still waiting
 * @param timeZone the zone the request is read against, recorded on its job
 */
public record RequestInTheWay(
		UUID requestId,
		boolean accepted,
		Instant startsAt,
		Instant endsAt,
		String timeZone,
		String customerName,
		String serviceName) {
}
