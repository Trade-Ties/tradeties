package com.tradeties.job;

import java.time.LocalDateTime;

/**
 * An appointment a business enters itself, on its own wall clock. Only the name is required of the
 * customer: the tradesperson may already know the rest.
 *
 * @param notes what needs doing, stored as the job's description
 */
public record AppointmentDetails(
		LocalDateTime startsAt,
		LocalDateTime endsAt,
		String customerName,
		String customerPhone,
		String customerEmail,
		String street1,
		String city,
		String state,
		String postalCode,
		String notes) {
}
