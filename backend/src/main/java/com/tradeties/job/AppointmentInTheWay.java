package com.tradeties.job;

import java.time.Instant;
import java.util.UUID;

/** An accepted appointment a new time would overlap, as the dialog answering it shows it. */
public record AppointmentInTheWay(
		UUID requestId,
		BookingParty bookedBy,
		Instant startsAt,
		Instant endsAt,
		String timeZone,
		String customerName,
		String serviceName) {
}
