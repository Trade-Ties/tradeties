package com.tradeties.business;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * What the customer's calendar is drawn from: one service at one business, and when it can be
 * done.
 *
 * <p>{@link Openings} with the three facts the port had no way to know bolted on — which service
 * was asked about, which zone the starts are to be read in, and how long each one runs. The last
 * is the reason this is a type and not just a list: a start time is a point, and a calendar draws
 * spans.
 *
 * <p>Nothing here identifies anybody, which is the property every anonymous answer on this side
 * of the API has to keep. It is also the easiest one to lose — the obvious next field is who
 * holds the appointment that made a slot disappear, and that field must never arrive.
 */
public record ServiceAvailability(
		UUID serviceId,
		String timeZone,
		int appointmentMinutes,
		LocalDate from,
		LocalDate to,
		List<Instant> slots,
		boolean slotsCapped) {

	public ServiceAvailability {
		slots = slots == null ? List.of() : List.copyOf(slots);
	}
}
