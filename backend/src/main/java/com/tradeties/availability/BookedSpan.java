package com.tradeties.availability;

import java.time.Instant;

/**
 * One appointment a business has accepted, reduced to the two fields the slot walk reads.
 *
 * <p>Not the request. The walk is arithmetic and has no business holding a row that knows what it
 * cost or who asked for it.
 */
public record BookedSpan(Instant startsAt, Instant endsAt) {

	public BookedSpan {
		if (startsAt == null || endsAt == null || !endsAt.isAfter(startsAt)) {
			throw new IllegalArgumentException("A booked span ends after it starts");
		}
	}
}
